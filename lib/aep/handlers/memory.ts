// lib/aep/handlers/memory.ts
import { prisma } from "@/lib/prisma";
import { newAepId } from "../ids";
import { AepError } from "../errors";
import type { AepContext } from "../context";

async function assertTreeAccess(treeRootId: string, userId: string) {
  const root = await prisma.agent.findFirst({ where: { aepId: treeRootId, userId } });
  if (!root) throw new AepError("tree_boundary_violation", `Tree root ${treeRootId} not accessible`);
}

export async function memoryWrite(
  params: { tree_root_id: string; namespace: string; key: string; value: unknown; subject_id?: string; ttl_seconds?: number },
  ctx: AepContext,
) {
  await assertTreeAccess(params.tree_root_id, ctx.userId);
  const aepId = newAepId("mem");
  const expiresAt = params.ttl_seconds ? new Date(Date.now() + params.ttl_seconds * 1000) : null;
  // Use upsert keyed on (tree_root_id, namespace, key)
  const rec = await prisma.aepMemoryRecord.upsert({
    where: { treeRootId_namespace_key: { treeRootId: params.tree_root_id, namespace: params.namespace, key: params.key } },
    create: {
      aepId, treeRootId: params.tree_root_id, namespace: params.namespace, key: params.key,
      value: params.value as any, subjectId: params.subject_id ?? null,
      ttlSeconds: params.ttl_seconds ?? null, expiresAt,
      createdByAgentId: params.tree_root_id,   // placeholder — agent context comes from Task 17 wiring
    },
    update: { value: params.value as any, subjectId: params.subject_id ?? null, ttlSeconds: params.ttl_seconds ?? null, expiresAt },
  });
  return serializeMemory(rec);
}

export async function memoryRead(
  params: { tree_root_id: string; namespace: string; key?: string; limit?: number; cursor?: string },
  ctx: AepContext,
) {
  await assertTreeAccess(params.tree_root_id, ctx.userId);
  if (params.key) {
    const rec = await prisma.aepMemoryRecord.findUnique({
      where: { treeRootId_namespace_key: { treeRootId: params.tree_root_id, namespace: params.namespace, key: params.key } },
    });
    return { records: rec ? [serializeMemory(rec)] : [], next_cursor: null };
  }
  const take = Math.min(params.limit ?? 50, 200);
  const rows = await prisma.aepMemoryRecord.findMany({
    where: { treeRootId: params.tree_root_id, namespace: params.namespace },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(params.cursor ? { cursor: { aepId: params.cursor }, skip: 1 } : {}),
  });
  const next_cursor = rows.length > take ? rows[take - 1].aepId : null;
  return { records: rows.slice(0, take).map(serializeMemory), next_cursor };
}

export async function memorySearch(
  _params: { tree_root_id: string; namespace: string; query: string; k?: number },
  _ctx: AepContext,
) {
  // Semantic search requires an embedding provider; not implemented in Plan 2.
  throw new AepError("capability_not_supported", "Semantic memory.search not implemented in this runtime");
}

export async function memoryDelete(
  params: { id?: string; tree_root_id?: string; namespace?: string; subject_id?: string },
  ctx: AepContext,
) {
  if (params.id) {
    const rec = await prisma.aepMemoryRecord.findUnique({ where: { aepId: params.id } });
    if (!rec) return { deleted: 0 };
    await assertTreeAccess(rec.treeRootId, ctx.userId);
    await prisma.aepMemoryRecord.delete({ where: { id: rec.id } });
    return { deleted: 1 };
  }
  if (params.tree_root_id) {
    await assertTreeAccess(params.tree_root_id, ctx.userId);
    const where: any = { treeRootId: params.tree_root_id };
    if (params.namespace) where.namespace = params.namespace;
    if (params.subject_id) where.subjectId = params.subject_id;
    const res = await prisma.aepMemoryRecord.deleteMany({ where });
    return { deleted: res.count };
  }
  throw new AepError("tool_not_found", "memory.delete requires id or tree_root_id");
}

function serializeMemory(r: any) {
  return {
    id: r.aepId,
    tree_root_id: r.treeRootId,
    namespace: r.namespace,
    key: r.key,
    value: r.value,
    embedding: r.embedding?.length ? r.embedding : null,
    created_by_agent_id: r.createdByAgentId,
    created_at: r.createdAt.toISOString(),
    subject_id: r.subjectId,
    ttl_seconds: r.ttlSeconds,
  };
}
