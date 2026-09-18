// lib/agents/tools/canva/create_canva_presentation.ts
import { z } from "zod";
import { registerTool } from "../../tool-registry";
import type { ToolDef } from "../../types";
import { prisma } from "@/lib/prisma";
import { generateDeck } from "@/lib/presentations/generate-deck";
import { buildPptxBuffer } from "@/lib/presentations/build-pptx";
import { storePptx } from "@/lib/presentations/pptx-store";
import { importPptxIntoCanva } from "./canva-import";
import { requireCanvaConnection } from "./canva-connection";
import { newAepId } from "@/lib/aep/ids";
import { emitAepEvent } from "@/lib/aep/events";

const schema = z.object({
  topic: z.string().min(3).max(2000),
  title: z.string().min(1).max(255).optional(),
});

const tool: ToolDef<typeof schema> = {
  slug: "create_canva_presentation",
  description:
    "Generate a professional slide deck on a topic, save it as a PPTX artifact, and import it into Canva — all in one call. Use this for 'create a presentation about X' or 'research X and make a deck' requests. Returns { artifactId, designId, editUrl, title, slideCount, deck } after the Canva import completes. Wait for this tool to return before continuing — it polls Canva until the import is done. Surface editUrl to the user as a clickable link.",
  schema,
  async execute(ctx, { topic, title }) {
    // Fail fast if Canva isn't connected so we don't burn tokens on deck generation.
    const conn = await requireCanvaConnection(ctx.userId);
    if (!conn.ok) return conn;

    let deck;
    try {
      deck = await generateDeck(topic);
    } catch (e) {
      return { ok: false, error: `Deck generation failed: ${e instanceof Error ? e.message : String(e)}` };
    }

    const effectiveTitle = title ?? deck.title ?? topic.slice(0, 80);

    let buffer: Buffer;
    try {
      buffer = await buildPptxBuffer(deck);
    } catch (e) {
      return { ok: false, error: `PPTX build failed: ${e instanceof Error ? e.message : String(e)}` };
    }

    const safeName = effectiveTitle.replace(/[^a-zA-Z0-9 ]/g, "").trim() || "presentation";
    const filename = `${safeName}.pptx`;
    const mimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    const content = `data:${mimeType};base64,${buffer.toString("base64")}`;

    const artifact = await prisma.agentArtifact.create({
      data: {
        runId: ctx.runId,
        name: filename,
        mimeType,
        content,
        aepId: newAepId("art"),
        sizeBytes: buffer.byteLength,
      },
    });

    void emitAepEvent(ctx.runId, "artifact.created", {
      artifact_id: artifact.aepId ?? artifact.id,
      name: artifact.name,
      mime_type: artifact.mimeType,
      size_bytes: artifact.sizeBytes,
    }).catch((err) => {
      console.warn(`[aep] emit artifact.created failed for ${artifact.id}:`, err);
    });

    const { downloadUrl } = storePptx(buffer, effectiveTitle);
    const importRes = await importPptxIntoCanva(ctx.userId, downloadUrl, effectiveTitle);
    if (!importRes.ok) return importRes;

    return {
      ok: true,
      data: {
        artifactId: artifact.id,
        designId: importRes.designId,
        editUrl: importRes.editUrl,
        viewUrl: importRes.viewUrl,
        title: effectiveTitle,
        slideCount: deck.slides.length,
        deck,
      },
    };
  },
};

registerTool(tool);
export default tool;
