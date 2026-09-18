// lib/aep/mcp/external.ts
//
// External (remote) MCP client wrapper. Used by the runner to connect to a
// third-party MCP server, list its tools, and route tool calls. Path B of the
// AEP spec §11. v1 supports only the modern Streamable HTTP transport — no
// stdio (security: don't run external processes from a hosted runtime), no
// websocket / SSE-only (legacy).
//
// Connection lifetime: per-run, lazy. Caller (resolveAgentToolsForRun) opens
// one wrapper per attached server at run start, reuses it for tool calls
// during the run, calls close() at run end. Connect is wrapped with a
// timeout so a misconfigured URL never hangs the run.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface ExternalMcpAuth {
  bearer?: string;
  headers?: Record<string, string>;
}

export interface ExternalMcpToolDescriptor {
  name: string;
  description?: string;
  inputSchema: unknown;
}

export interface ExternalMcpClientHandle {
  listTools(): Promise<ExternalMcpToolDescriptor[]>;
  callTool(name: string, args: unknown): Promise<{ ok: boolean; data?: unknown; error?: string }>;
  close(): Promise<void>;
}

const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;

export async function connectExternalMcp(
  serverUrl: string,
  auth: ExternalMcpAuth | null,
  opts?: { timeoutMs?: number },
): Promise<ExternalMcpClientHandle> {
  const headers: Record<string, string> = {
    ...(auth?.headers ?? {}),
    ...(auth?.bearer ? { Authorization: `Bearer ${auth.bearer}` } : {}),
  };
  const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
    requestInit: { headers },
  });
  const client = new Client({ name: "helix-runtime", version: "0.1.0" }, { capabilities: {} });

  // Wrap connect with a timeout — a hung handshake must not hang the run.
  const connectPromise = client.connect(transport);
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`mcp connect timeout after ${timeoutMs}ms`)), timeoutMs),
  );
  await Promise.race([connectPromise, timeout]);

  return {
    async listTools() {
      const res = await client.listTools();
      return (res.tools ?? []).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
    },

    async callTool(name, args) {
      try {
        const res = await client.callTool({
          name,
          arguments: args as Record<string, unknown>,
        });
        // MCP returns { content: Array<{type, text?} | ...>, isError? }; flatten
        // to the runner's ToolResult shape: ok | error + data string.
        const parts = (res.content ?? []) as Array<{ type?: string; text?: string }>;
        const text = parts
          .map((c) => (typeof c.text === "string" ? c.text : JSON.stringify(c)))
          .join("\n");
        if (res.isError) return { ok: false, error: text };
        return { ok: true, data: text };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },

    async close() {
      try {
        await client.close();
      } catch {
        // Best-effort close; the run is already ending.
      }
    },
  };
}
