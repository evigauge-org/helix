import { z } from "zod";
import { registerTool } from "../../tool-registry";
import type { ToolDef } from "../../types";
import { prisma } from "@/lib/prisma";
import { buildPptxBuffer } from "@/lib/presentations/build-pptx";
import { newAepId } from "@/lib/aep/ids";
import { emitAepEvent } from "@/lib/aep/events";

const slideLayouts = z.enum([
  "title", "promise", "inspiration", "heuristic", "content", "two_column",
  "key_stat", "quote", "evidence", "cycle", "contribution", "close",
]);

const slideSchema = z.object({
  layout: slideLayouts,
  title: z.string(),
  subtitle: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  leftColumn: z.object({ heading: z.string(), bullets: z.array(z.string()) }).optional(),
  rightColumn: z.object({ heading: z.string(), bullets: z.array(z.string()) }).optional(),
  stat: z.string().optional(),
  statLabel: z.string().optional(),
  quote: z.string().optional(),
  quoteAuthor: z.string().optional(),
  heuristic: z.string().optional(),
  evidence: z.string().optional(),
  contribution: z.string().optional(),
  notes: z.string().optional(),
});

const deckSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string(),
  promise: z.string(),
  slides: z.array(slideSchema).min(1).max(30),
});

const schema = z.object({
  deck: deckSchema,
  title: z.string().min(1).max(255).optional(),
});

const tool: ToolDef<typeof schema> = {
  slug: "create_pptx",
  description:
    "Build a PPTX file from a structured slide deck (title + promise + 12-15 slides across the Winston layouts) and save it as an AgentArtifact. Returns { artifactId, filename, slideCount, title }. Use when you have structured content and want to produce the PPTX yourself — then call import_canva_from_file to push it into Canva. Does NOT require Canva to be connected.",
  schema,
  async execute(ctx, args) {
    const title = args.title ?? args.deck.title;
    let buffer: Buffer;
    try {
      buffer = await buildPptxBuffer(args.deck);
    } catch (e) {
      return { ok: false, error: `PPTX build failed: ${e instanceof Error ? e.message : String(e)}` };
    }
    const safeName = title.replace(/[^a-zA-Z0-9 ]/g, "").trim() || "presentation";
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

    return {
      ok: true,
      data: {
        artifactId: artifact.id,
        filename,
        slideCount: args.deck.slides.length,
        title,
      },
    };
  },
};

registerTool(tool);
export default tool;
