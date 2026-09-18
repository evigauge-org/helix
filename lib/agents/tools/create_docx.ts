// lib/agents/tools/create_docx.ts
import { z } from "zod";
import { registerTool } from "../tool-registry";
import type { ToolDef } from "../types";
import { prisma } from "@/lib/prisma";
import { Packer } from "docx";
import { renderMarkdownToDocx } from "@/lib/docx/md-to-docx";
import { newAepId } from "@/lib/aep/ids";
import { emitAepEvent } from "@/lib/aep/events";

const schema = z.object({
  title: z.string().min(1).max(255),
  markdown: z.string().min(1).max(500_000),
  subtitle: z.string().max(255).optional(),
  author: z.string().max(100).optional(),
  coverPage: z.boolean().default(true),
});

const tool: ToolDef<typeof schema> = {
  slug: "create_docx",
  description:
    "Turn a markdown string into a branded Helix DOCX artifact that the user can download from the side preview panel (or attach via send_email). Supports headings, paragraphs, bold/italic/strike, bullet + ordered lists, blockquotes, code blocks, inline code, hyperlinks, tables, horizontal rules, and images (as alt+url passthrough). Returns { artifactId, filename, mimeType, bytes, tokenCount, unmappedTokens }. Use for investment memos, research reports, briefs, policy docs — anything the user wants as a .docx.",
  schema,
  async execute(ctx, args) {
    try {
      const { document, tokenCount, unmappedTokens } = renderMarkdownToDocx({
        title: args.title,
        markdown: args.markdown,
        subtitle: args.subtitle,
        author: args.author,
        coverPage: args.coverPage,
      });

      const buffer = await Packer.toBuffer(document);
      const mimeType =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const safeName = args.title.replace(/[^a-zA-Z0-9 ]/g, "").trim() || "document";
      const filename = `${safeName}.docx`;
      const content = `data:${mimeType};base64,${Buffer.from(buffer).toString("base64")}`;

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
          mimeType,
          bytes: buffer.byteLength,
          tokenCount,
          unmappedTokens,
        },
      };
    } catch (e) {
      return {
        ok: false,
        error: `create_docx failed: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  },
};

registerTool(tool);
export default tool;
