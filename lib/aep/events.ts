// lib/aep/events.ts
import { prisma } from "@/lib/prisma";
import { newAepId } from "./ids";

export type AepEventType =
  | "run.started" | "run.ended"
  | "cycle.started" | "cycle.ended"
  | "tool.called" | "tool.returned"
  | "subagent.spawned"
  | "message.sent" | "message.delivered"
  | "prompt.modified" | "prompt.change_queued" | "prompt.change_rejected"
  | "memory.written"
  | "artifact.created"
  | "error";

export async function emitAepEvent(runId: string, type: AepEventType, payload: unknown) {
  // Per-run advisory lock serializes read-then-write inside a single tx so
  // concurrent emits on the same run can never compute the same sequenceNum.
  // hashtext(runId) keys the lock per run — different runs use different lock
  // slots, so they never block each other. The lock is released automatically
  // at tx end. No retries, no silent drops under burst load.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${runId})::bigint)`;
    const last = await tx.aepEvent.findFirst({
      where: { runId },
      orderBy: { sequenceNum: "desc" },
      select: { sequenceNum: true },
    });
    await tx.aepEvent.create({
      data: {
        aepId: newAepId("evt"),
        runId,
        type,
        sequenceNum: (last?.sequenceNum ?? 0) + 1,
        payload: payload as any,
      },
    });
  });
}
