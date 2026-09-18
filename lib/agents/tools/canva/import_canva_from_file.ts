// lib/agents/tools/canva/import_canva_from_file.ts
import { z } from "zod";
import { registerTool } from "../../tool-registry";
import type { ToolDef } from "../../types";
import { prisma } from "@/lib/prisma";
import { storePptx } from "@/lib/presentations/pptx-store";
import { importPptxIntoCanva } from "./canva-import";
import { requireCanvaConnection } from "./canva-connection";

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]);

const schema = z.object({
  artifact_id: z.string(),
  title: z.string().min(1).max(255).optional(),
});

const tool: ToolDef<typeof schema> = {
  slug: "import_canva_from_file",
  description:
    "Import an existing AgentArtifact (PPTX, PDF, DOCX, JPG, PNG) into Canva as a new design. Polls Canva until the import completes before returning. Returns { designId, editUrl }. Use after create_pptx or download_file. Wait for this tool to finish before continuing.",
  schema,
  async execute(ctx, { artifact_id, title }) {
    const conn = await requireCanvaConnection(ctx.userId);
    if (!conn.ok) return conn;

    const artifact = await prisma.agentArtifact.findUnique({
      where: { id: artifact_id },
      include: { run: { select: { agent: { select: { userId: true } } } } },
    });
    if (!artifact || artifact.run.agent.userId !== ctx.userId) {
      return { ok: false, error: "Artifact not found or not owned by you" };
    }
    if (!ALLOWED_MIMES.has(artifact.mimeType)) {
      return {
        ok: false,
        error: `Canva import supports pdf/pptx/docx/jpg/png only (got ${artifact.mimeType})`,
      };
    }

    const content = artifact.content ?? "";
    const dataMatch = /^data:([^;]+);base64,([\s\S]+)$/.exec(content);
    if (!dataMatch) {
      return { ok: false, error: "Artifact content is not a data: URI — cannot import" };
    }
    const bytes = Buffer.from(dataMatch[2], "base64");

    const effectiveTitle = (title ?? artifact.name.replace(/\.[^.]+$/, "")) || "Imported design";
    const extMatch = /\.([^.]+)$/.exec(artifact.name);
    const filenameExt = extMatch ? extMatch[1].toLowerCase() : "bin";
    const { downloadUrl } = storePptx(bytes, effectiveTitle, {
      mimeType: artifact.mimeType,
      filenameExt,
    });
    const importRes = await importPptxIntoCanva(ctx.userId, downloadUrl, effectiveTitle);
    if (!importRes.ok) return importRes;

    return {
      ok: true,
      data: {
        designId: importRes.designId,
        editUrl: importRes.editUrl,
        viewUrl: importRes.viewUrl,
        title: effectiveTitle,
      },
    };
  },
};

registerTool(tool);
export default tool;
