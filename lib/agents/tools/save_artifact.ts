import { z } from "zod";
import { registerTool } from "../tool-registry";
import type { ToolDef } from "../types";
import { prisma } from "@/lib/prisma";
import { newAepId } from "@/lib/aep/ids";
import { emitAepEvent } from "@/lib/aep/events";

const schema = z.object({
  name: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(100),
  content: z.string().min(1).max(5_000_000),
});

const tool: ToolDef<typeof schema> = {
  slug: "save_artifact",
  description: "Save a deliverable (markdown report, JSON data, text summary) for the user to download from the dashboard.",
  schema,
  async execute(ctx, { name, mimeType, content }) {
    const count = await prisma.agentArtifact.count({ where: { runId: ctx.runId } });
    if (count >= 50) return { ok: false, error: "artifact cap (50/run) reached" };
    const sizeBytes = Buffer.byteLength(content, "utf8");
    const row = await prisma.agentArtifact.create({
      data: {
        runId: ctx.runId,
        name,
        mimeType,
        content,
        aepId: newAepId("art"),
        sizeBytes,
      },
    });
    void emitAepEvent(ctx.runId, "artifact.created", {
      artifact_id: row.aepId ?? row.id,
      name: row.name,
      mime_type: row.mimeType,
      size_bytes: row.sizeBytes,
    }).catch((err) => {
      console.warn(`[aep] emit artifact.created failed for ${row.id}:`, err);
    });
    return { ok: true, data: { artifactId: row.id, name, mimeType, bytes: content.length } };
  },
};

registerTool(tool);
export default tool;
