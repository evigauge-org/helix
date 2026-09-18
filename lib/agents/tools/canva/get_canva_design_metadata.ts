// lib/agents/tools/canva/get_canva_design_metadata.ts
import { z } from "zod";
import { registerTool } from "../../tool-registry";
import type { ToolDef } from "../../types";
import { executeCanvaTool } from "@/lib/composio";
import { requireCanvaConnection } from "./canva-connection";

const schema = z.object({ design_id: z.string() });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(d: any) {
  return {
    designId: String(d?.id ?? ""),
    title: d?.title ?? null,
    editUrl: d?.urls?.edit_url ?? "",
    viewUrl: d?.urls?.view_url ?? "",
    thumbnailUrl: d?.thumbnail?.url ?? null,
    pageCount: typeof d?.page_count === "number" ? d.page_count : null,
    createdAt: typeof d?.created_at === "number" ? d.created_at : 0,
    updatedAt: typeof d?.updated_at === "number" ? d.updated_at : 0,
  };
}

const tool: ToolDef<typeof schema> = {
  slug: "get_canva_design_metadata",
  description:
    "Fetch metadata for a Canva design by id (title, edit URL, view URL, thumbnail, page count, timestamps). Use when the user references a design and you need its editUrl without creating a new one.",
  schema,
  async execute(ctx, { design_id }) {
    const conn = await requireCanvaConnection(ctx.userId);
    if (!conn.ok) return conn;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await executeCanvaTool(
        "CANVA_FETCH_DESIGN_METADATA_AND_ACCESS_INFORMATION",
        ctx.userId,
        { designId: design_id },
      );
      const d = result?.data?.design ?? result?.design ?? result?.data ?? {};
      return { ok: true, data: normalize(d) };
    } catch (e) {
      return { ok: false, error: `get_canva_design_metadata failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  },
};

registerTool(tool);
export default tool;
