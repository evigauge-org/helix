// lib/agents/tools/downloads/download_nse_report.ts
import { z } from "zod";
import { registerTool } from "../../tool-registry";
import type { ToolDef } from "../../types";
import { prisma } from "@/lib/prisma";
import { fetchBinary, encodeBinaryArtifact } from "./http-fetch-binary";
import { resolveNseReport, latestWeekday, type NseReportName } from "./nse-reports-catalog";
import { newAepId } from "@/lib/aep/ids";
import { emitAepEvent } from "@/lib/aep/events";

const schema = z.object({
  report_name: z.enum([
    "participant_wise_oi",
    "participant_wise_volume",
    "category_wise_oi",
    "market_activity_report",
    "fo_bhavcopy",
    "cm_bhavcopy",
    "daily_reports_archive",
  ]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD").optional(),
});

const tool: ToolDef<typeof schema> = {
  slug: "download_nse_report",
  description:
    "Download a daily NSE report. Supports common derivatives + cash reports (participant-wise OI, bhavcopy, market activity, etc.). Date format YYYY-MM-DD; defaults to the latest weekday. Returns { artifactId, name, mimeType, bytes }. If the file is not found for the given date (market holiday, future date), returns a structured error.",
  schema,
  async execute(ctx, { report_name, date }) {
    const isoDate = date ?? latestWeekday();
    const resolved = resolveNseReport(report_name as NseReportName, isoDate);
    try {
      const res = await fetchBinary({ url: resolved.url, referer: resolved.referer, filenameOverride: resolved.filename });
      const encoded = encodeBinaryArtifact(res.bytes, res.mimeType || resolved.mime);
      const artifact = await prisma.agentArtifact.create({
        data: {
          runId: ctx.runId,
          name: res.filename,
          mimeType: res.mimeType || resolved.mime,
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
        data: { artifactId: artifact.id, name: res.filename, mimeType: res.mimeType || resolved.mime, bytes: res.bytes.byteLength },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/HTTP 404/.test(msg)) {
        return { ok: false, error: `NSE report not found for ${isoDate}; the market may have been closed, or the file has not been published yet. Try a different date.` };
      }
      return { ok: false, error: `download_nse_report failed: ${msg}` };
    }
  },
};

registerTool(tool);
export default tool;
