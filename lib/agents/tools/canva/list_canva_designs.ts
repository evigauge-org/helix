// lib/agents/tools/canva/list_canva_designs.ts
import { z } from "zod";
import { registerTool } from "../../tool-registry";
import type { ToolDef } from "../../types";
import { composio, executeCanvaTool } from "@/lib/composio";
import { requireCanvaConnection } from "./canva-connection";

const schema = z.object({
  query: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
  continuation_token: z.string().optional(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeList(items: any[]) {
  return items.map((d) => ({
    designId: String(d?.id ?? ""),
    title: d?.title ?? null,
    editUrl: d?.urls?.edit_url ?? "",
    thumbnailUrl: d?.thumbnail?.url ?? null,
    updatedAt: typeof d?.updated_at === "number" ? d.updated_at : 0,
  }));
}

const tool: ToolDef<typeof schema> = {
  slug: "list_canva_designs",
  description:
    "List the user's recent Canva designs (optionally filtered by query). Paginated via continuation_token. Use when the user refers to a design whose id you don't know. Returns { designs: [{designId,title,editUrl,thumbnailUrl,updatedAt}], continuationToken }.",
  schema,
  async execute(ctx, { query, limit, continuation_token }) {
    const conn = await requireCanvaConnection(ctx.userId);
    if (!conn.ok) return conn;

    const args: Record<string, unknown> = { limit: limit ?? 20 };
    if (query) args.query = query;
    if (continuation_token) args.continuation = continuation_token;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await executeCanvaTool("CANVA_LIST_DESIGNS", ctx.userId, args);
      const items = result?.data?.items ?? result?.data?.designs ?? result?.items ?? [];
      const continuation = result?.data?.continuation ?? result?.continuation;
      return {
        ok: true,
        data: {
          designs: normalizeList(Array.isArray(items) ? items : []),
          continuationToken: continuation ?? null,
        },
      };
    } catch (primaryErr) {
      console.error("CANVA_LIST_DESIGNS primary failed, falling back to REST:", primaryErr);
      // Fallback: raw REST via proxyExecute if the slug isn't in the toolkit.
      const params = new URLSearchParams();
      params.set("limit", String(limit ?? 20));
      if (query) params.set("query", query);
      if (continuation_token) params.set("continuation", continuation_token);
      const res = await composio.tools.proxyExecute({
        endpoint: `https://api.canva.com/rest/v1/designs?${params}`,
        method: "GET",
        connectedAccountId: conn.connectedAccountId,
      });
      if (res.status < 200 || res.status >= 300) {
        const primaryMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
        return {
          ok: false,
          error: `Canva list failed (HTTP ${res.status}; primary: ${primaryMsg.slice(0, 200)})`,
        };
      }
      const data = res.data as Record<string, unknown> | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = (data as any)?.items ?? (data as any)?.designs ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const continuation = (data as any)?.continuation ?? null;
      return {
        ok: true,
        data: {
          designs: normalizeList(Array.isArray(items) ? items : []),
          continuationToken: continuation,
        },
      };
    }
  },
};

registerTool(tool);
export default tool;
