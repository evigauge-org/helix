import { z } from "zod";
import { registerTool } from "../../tool-registry";
import type { ToolDef } from "../../types";
import { prisma } from "@/lib/prisma";
import { fetchBinary, encodeBinaryArtifact, MAX_DOWNLOAD_BYTES } from "./http-fetch-binary";
import { newAepId } from "@/lib/aep/ids";
import { emitAepEvent } from "@/lib/aep/events";

const schema = z.object({
  url: z.string().url(),
  filename: z.string().min(1).max(200).optional(),
  referer: z.string().url().optional(),
});

const tool: ToolDef<typeof schema> = {
  slug: "download_file",
  description:
    "Download a file (CSV, XLSX, PDF, ZIP, image, etc.) from a public URL and save it as a downloadable artifact. Use when the user asks to fetch or save a specific file. For sites with anti-bot protection (like nseindia.com or bseindia.com), pass referer='https://www.nseindia.com/all-reports-derivatives' so the server warms session cookies before the download. Returns { artifactId, name, mimeType, bytes }. Max 20MB per download.",
  schema,
  async execute(ctx, { url, filename, referer }) {
    try {
      const res = await fetchBinary({ url, referer, filenameOverride: filename });
      const encoded = encodeBinaryArtifact(res.bytes, res.mimeType);
      if (encoded.length > MAX_DOWNLOAD_BYTES * 2) {
        return { ok: false, error: "encoded artifact exceeds storage cap" };
      }
      const artifact = await prisma.agentArtifact.create({
        data: {
          runId: ctx.runId,
          name: res.filename,
          mimeType: res.mimeType,
          content: encoded,
          aepId: newAepId("art"),
          sizeBytes: res.bytes.byteLength,
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
          name: res.filename,
          mimeType: res.mimeType,
          bytes: res.bytes.byteLength,
        },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: `download_file failed: ${msg}` };
    }
  },
};

registerTool(tool);
export default tool;
