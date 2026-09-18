// lib/agents/tools/canva/create_canva_design.ts
import { z } from "zod";
import { registerTool } from "../../tool-registry";
import type { ToolDef } from "../../types";
import { executeCanvaTool } from "@/lib/composio";
import { requireCanvaConnection } from "./canva-connection";

const schema = z.object({
  title: z.string().min(1).max(255),
  design_type: z.enum(["doc", "whiteboard", "email"]),
});

const tool: ToolDef<typeof schema> = {
  slug: "create_canva_design",
  description:
    "Create a blank Canva design (doc, whiteboard, or email). NOT for presentations — use create_canva_presentation or create_pptx+import_canva_from_file for slide decks, because blank presentation designs are empty and not useful. Blank designs auto-delete after 7 days if never edited. Returns { designId, editUrl, design_type, title }.",
  schema,
  async execute(ctx, { title, design_type }) {
    const conn = await requireCanvaConnection(ctx.userId);
    if (!conn.ok) return conn;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await executeCanvaTool("CANVA_POST_DESIGNS", ctx.userId, {
        design_type: { type: "preset", name: design_type },
        title,
      });
      const d = result?.data?.design ?? result?.design ?? result?.data ?? {};
      const designId = d?.id ?? result?.data?.id;
      const editUrl = d?.urls?.edit_url ?? "";
      const viewUrl = d?.urls?.view_url;
      if (!designId || !editUrl) {
        return { ok: false, error: `Canva returned no designId/editUrl: ${JSON.stringify(result?.data ?? {}).slice(0, 300)}` };
      }
      return { ok: true, data: { designId, editUrl, viewUrl, design_type, title } };
    } catch (e) {
      return { ok: false, error: `create_canva_design failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  },
};

registerTool(tool);
export default tool;
