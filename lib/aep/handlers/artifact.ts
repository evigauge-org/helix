// lib/aep/handlers/artifact.ts
import { prisma } from "@/lib/prisma";
import { AepError } from "../errors";
import type { AepContext } from "../context";

export async function artifactGet(params: { artifact_id: string }, ctx: AepContext) {
  const a = await prisma.agentArtifact.findFirst({
    where: { aepId: params.artifact_id, run: { userId: ctx.userId } },
    include: { run: { include: { agent: true } } },
  });
  if (!a) throw new AepError("tool_not_found", "Artifact not found");
  return serializeArtifact(a);
}

export async function artifactList(
  params: { run_id?: string; agent_id?: string; subject_id?: string; cursor?: string; limit?: number },
  ctx: AepContext,
) {
  const where: any = { run: { userId: ctx.userId } };
  if (params.run_id) where.run = { ...where.run, aepId: params.run_id };
  if (params.agent_id) where.run = { ...where.run, agent: { aepId: params.agent_id } };
  if (params.subject_id) where.subjectId = params.subject_id;
  const take = Math.min(params.limit ?? 50, 200);
  const rows = await prisma.agentArtifact.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(params.cursor ? { cursor: { aepId: params.cursor }, skip: 1 } : {}),
    include: { run: { include: { agent: true } } },
  });
  const next_cursor = rows.length > take ? rows[take - 1].aepId : null;
  return { artifacts: rows.slice(0, take).map(serializeArtifact), next_cursor };
}

export async function artifactDelete(params: { artifact_id: string }, ctx: AepContext) {
  const a = await prisma.agentArtifact.findFirst({ where: { aepId: params.artifact_id, run: { userId: ctx.userId } } });
  if (!a) throw new AepError("tool_not_found", "Artifact not found");
  await prisma.agentArtifact.delete({ where: { id: a.id } });
  return { ok: true };
}

function serializeArtifact(a: any) {
  return {
    id: a.aepId,
    name: a.name,
    mime_type: a.mimeType,
    size_bytes: a.sizeBytes ?? (a.content ? Buffer.byteLength(a.content, "utf8") : 0),
    sha256: a.sha256 ?? "",
    created_at: a.createdAt.toISOString(),
    created_by: { agent_id: a.run.agent.aepId, run_id: a.run.aepId },
    run_id: a.run.aepId,
    subject_id: a.subjectId,
    metadata: a.aepMetadata ?? {},
  };
}
