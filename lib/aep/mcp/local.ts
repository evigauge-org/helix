// lib/aep/mcp/local.ts
//
// Local (in-process) MCP adapter for Helix's existing ToolDef registry.
//
// This is a *normalization layer* — it does not change tool behavior. It
// presents Helix's tools under an MCP-style contract:
//   - listTools(agentId)          -> tools/list  (namespaced as "helix.<slug>")
//   - callTool(name, args, ctx)   -> tools/call  (returns { ok, data?, error? })
//
// External callers (e.g. AEP's future `send_message`, or a Path-B remote MCP
// transport) can depend on this interface without touching the runner. The
// runner itself still calls `ToolDef.execute` directly on its hot path for
// now; this adapter is a thin forwarder on top of the same registry.
//
// NOTE on signature deviation from plan (2026-04-24-aep-plan-2-runtime-self,
// Task 18.1): the plan's pseudocode calls `getToolsForAgent(agentId)` and
// awaits it. The real `getToolsForAgent` in `lib/agents/tool-registry.ts`
// takes `userSelectedSlugs: string[]` synchronously. To preserve the plan's
// intent (agent-scoped tool visibility) without inventing a signature, we
// look up the agent row here and pass its `toolSlugs` into the registry.

import { prisma } from "@/lib/prisma";
import { getToolsForAgent } from "@/lib/agents/tool-registry";
import type { ToolContext } from "@/lib/agents/types";

export interface McpToolDescriptor {
  name: string;
  description: string;
  input_schema: unknown;
  output_schema?: unknown;
  requires_subject_id?: boolean;
  side_effect_class?: "read" | "write" | "external";
  cost_hint?: "cheap" | "expensive";
}

export interface LocalMcp {
  listTools(agentId: string): Promise<McpToolDescriptor[]>;
  callTool(
    name: string,
    args: unknown,
    ctx: ToolContext,
  ): Promise<{ ok: boolean; data?: unknown; error?: string }>;
}

async function resolveAgentTools(agentId: string) {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { toolSlugs: true },
  });
  return getToolsForAgent(agent?.toolSlugs ?? []);
}

export const localMcp: LocalMcp = {
  async listTools(agentId) {
    const tools = await resolveAgentTools(agentId);
    return tools.map((t) => ({
      name: `helix.${t.slug}`,
      description: t.description,
      input_schema: (t as any).schema?._def ?? {},
      side_effect_class: ((t as any).sideEffectClass ?? "external") as
        | "read"
        | "write"
        | "external",
      cost_hint: ((t as any).costHint ?? "cheap") as "cheap" | "expensive",
      requires_subject_id: Boolean((t as any).requiresSubjectId),
    }));
  },

  async callTool(name, args, ctx) {
    const bare = name.replace(/^helix\./, "");
    const tools = await resolveAgentTools(ctx.agentId);
    const tool = tools.find((t) => t.slug === bare);
    if (!tool) return { ok: false, error: `Tool not found: ${name}` };
    const result = await tool.execute(ctx, args as any);
    // ToolResult is { ok: true; data? } | { ok: false; error }; normalize to
    // the MCP return shape (optional data / optional error on one object).
    if (result.ok) return { ok: true, data: (result as any).data };
    return { ok: false, error: (result as any).error };
  },
};
