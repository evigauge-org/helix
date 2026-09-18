// lib/aep/handlers/approve-prompt-change.ts
import { prisma } from "@/lib/prisma";
import { emitAepEvent } from "../events";
import { newAepId } from "../ids";
import { AepError } from "../errors";
import type { AepContext } from "../context";

export async function agentApprovePromptChange(
  params: { agent_id: string; pending_change_id: string; approve: boolean; comment?: string },
  ctx: AepContext,
) {
  const pending = await prisma.aepPendingPromptChange.findFirst({
    where: { aepId: params.pending_change_id, agent: { userId: ctx.userId, aepId: params.agent_id } },
    include: { agent: true },
  });
  if (!pending) throw new AepError("tool_not_found", "Pending change not found");
  if (pending.resolvedAt) throw new AepError("lifecycle_conflict", "Already resolved");

  if (!params.approve) {
    await prisma.aepPendingPromptChange.update({
      where: { id: pending.id },
      data: { resolvedAt: new Date(), resolution: "rejected", resolvedBy: ctx.userId, comment: params.comment ?? null },
    });
    // Emit on the agent's latest run (if any)
    const latestRun = await prisma.agentRun.findFirst({ where: { agentId: pending.agentId }, orderBy: { startedAt: "desc" } });
    if (latestRun) {
      await emitAepEvent(latestRun.id, "prompt.change_rejected", {
        pending_change_id: pending.aepId, reason: pending.reason, rejected_by: ctx.userId, comment: params.comment ?? null,
      });
    }
    return { applied: false };
  }

  // Apply: write to agent.constitutionMutable + systemPromptExtra; record in history
  const phe = await prisma.$transaction(async (tx) => {
    await tx.agent.update({
      where: { id: pending.agentId },
      data: { constitutionMutable: pending.proposedContent, systemPromptExtra: pending.proposedContent },
    });
    const entry = await tx.aepPromptHistoryEntry.create({
      data: {
        aepId: newAepId("phe"),
        agentId: pending.agentId,
        diff: pending.proposedDiff,
        reason: pending.reason,
        approvedBy: ctx.userId,
        status: "applied",
      },
    });
    await tx.aepPendingPromptChange.update({
      where: { id: pending.id },
      data: { resolvedAt: new Date(), resolution: "approved", resolvedBy: ctx.userId, comment: params.comment ?? null },
    });
    return entry;
  });

  const latestRun = await prisma.agentRun.findFirst({ where: { agentId: pending.agentId }, orderBy: { startedAt: "desc" } });
  if (latestRun) {
    await emitAepEvent(latestRun.id, "prompt.modified", { diff: phe.diff, reason: phe.reason, approved_by: ctx.userId });
  }
  return { applied: true, history_entry_id: phe.aepId };
}
