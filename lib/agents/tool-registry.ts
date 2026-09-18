import type { ToolDef } from "./types";
import { modifyOwnPromptTool } from "./tools/modify-own-prompt";
import { sendMessageTool } from "./tools/send-message";
import { inboxReadTool } from "./tools/inbox";
import { spawnSubagentTool } from "./tools/spawn-subagent";
import {
  learningMemoryWriteTool,
  learningMemoryReadTool,
  learningMemoryDeleteTool,
} from "./tools/learning-memory";
import { searchKnowledgeTool } from "./tools/search-knowledge";
import { runCodeTool } from "./tools/run_code";
import { screenerCompanyTool } from "./tools/screener_company";
import { IB_TOOLS } from "./tools/ib";
import { INDIA_GOV_TOOLS } from "./tools/india_gov";
import { INSURANCE_TOOLS } from "./tools/insurance";
import { prisma } from "@/lib/prisma";
import {
  connectExternalMcp,
  type ExternalMcpClientHandle,
} from "@/lib/aep/mcp/external";

const registry = new Map<string, ToolDef>();

export const toolRegistry: ReadonlyMap<string, ToolDef> = registry;

export function registerTool(tool: ToolDef) {
  registry.set(tool.slug, tool);
}

registerTool(modifyOwnPromptTool);
registerTool(sendMessageTool);
registerTool(inboxReadTool);
registerTool(spawnSubagentTool);
registerTool(learningMemoryWriteTool);
registerTool(learningMemoryReadTool);
registerTool(learningMemoryDeleteTool);
registerTool(searchKnowledgeTool);
registerTool(runCodeTool);
registerTool(screenerCompanyTool);
for (const tool of IB_TOOLS) registerTool(tool);
for (const tool of INDIA_GOV_TOOLS) registerTool(tool);
for (const tool of INSURANCE_TOOLS) registerTool(tool);

const ALWAYS_PRESENT = new Set([
  "sleep", "complete", "continue_now",
  "edit_persona", "add_tool", "remove_tool", "adjust_caps",
  "create_skill", "edit_skill", "delete_skill", "run_skill",
  "replicate", "send_message", "inbox_read",
  "modify_own_prompt",
  "spawn_subagent",
  "learning_memory_write", "learning_memory_read", "learning_memory_delete",
]);

export function getToolsForAgent(userSelectedSlugs: string[]): ToolDef[] {
  const out: ToolDef[] = [];
  for (const [slug, tool] of registry) {
    if (ALWAYS_PRESENT.has(slug) || userSelectedSlugs.includes(slug)) {
      out.push(tool);
    }
  }
  return out;
}

// --- External MCP integration (Plan 5 / Phase 6) ---------------------------

export interface AgentRunToolHandles {
  /** Built-in Helix tools + remote tools projected as ToolDef proxies. */
  tools: ToolDef[];
  /** Close all open MCP connections. Call from a finally block at run end. */
  closeAll: () => Promise<void>;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "server"
  );
}

function makeProxyToolDef(
  serverSlug: string,
  remote: { name: string; description?: string; inputSchema?: unknown },
  handle: ExternalMcpClientHandle,
): ToolDef {
  return {
    slug: `mcp.${serverSlug}.${remote.name}`,
    description: remote.description ?? `(external) ${remote.name} from ${serverSlug}`,
    // Remote tools advertise JSON Schema, not Zod. The runner skips its own
    // Zod pre-validation for these — the remote server validates and returns
    // a structured error if args don't match.
    schema: undefined as unknown as ToolDef["schema"],
    async execute(_ctx, args) {
      const res = await handle.callTool(remote.name, args);
      if (res.ok) return { ok: true, data: res.data } as ReturnType<ToolDef["execute"]> extends Promise<infer R> ? R : never;
      return { ok: false, error: res.error ?? "external tool error" } as ReturnType<ToolDef["execute"]> extends Promise<infer R> ? R : never;
    },
  };
}

/**
 * Resolve the full ToolDef list for a run: built-in Helix tools (selected via
 * the agent's toolSlugs) PLUS any tools advertised by external MCP servers
 * attached to the agent. Returns a handle whose `closeAll` MUST be called at
 * run end (typically from a try/finally) to close MCP connections.
 *
 * Failure isolation: if an external server fails to connect, that server is
 * skipped (lastError persisted on the row) and the run proceeds with the
 * remaining tools. One bad server doesn't kill the run.
 */
export async function resolveAgentToolsForRun(agentId: string): Promise<AgentRunToolHandles> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: {
      toolSlugs: true,
      externalMcpServers: { where: { enabled: true } },
    },
  });
  const local = getToolsForAgent(agent?.toolSlugs ?? []);
  const handles: ExternalMcpClientHandle[] = [];
  const external: ToolDef[] = [];

  for (const server of agent?.externalMcpServers ?? []) {
    const auth = (server.authJson ?? null) as
      | { bearer?: string; headers?: Record<string, string> }
      | null;
    let handle: ExternalMcpClientHandle;
    try {
      handle = await connectExternalMcp(server.url, auth);
    } catch (e) {
      await prisma.agentExternalMcpServer.update({
        where: { id: server.id },
        data: { lastError: e instanceof Error ? e.message : String(e) },
      });
      continue;
    }
    await prisma.agentExternalMcpServer.update({
      where: { id: server.id },
      data: { lastConnectedAt: new Date(), lastError: null },
    });
    handles.push(handle);
    const slug = slugify(server.name);
    try {
      const remoteTools = await handle.listTools();
      for (const rt of remoteTools) external.push(makeProxyToolDef(slug, rt, handle));
    } catch (e) {
      await prisma.agentExternalMcpServer.update({
        where: { id: server.id },
        data: { lastError: e instanceof Error ? e.message : String(e) },
      });
    }
  }

  return {
    tools: [...local, ...external],
    closeAll: async () => {
      await Promise.all(handles.map((h) => h.close()));
    },
  };
}
