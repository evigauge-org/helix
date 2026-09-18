import { inngest } from "./client";
import { prisma } from "@/lib/prisma";
import { runOneCycle } from "@/lib/agents/runner";
import { emitAepEvent } from "@/lib/aep/events";
import { newAepId } from "@/lib/aep/ids";

// Best-effort AEP event emit: never let telemetry failures kill a run.
function emitAep(runId: string, type: Parameters<typeof emitAepEvent>[1], payload: unknown) {
  void emitAepEvent(runId, type, payload).catch((err) => {
    console.warn(`[aep] emit ${type} failed for run ${runId}:`, err);
  });
}

function checkLifetimeCaps(
  run: { startedAt: Date; totalTokens: number; tickCount: number },
  agent: { maxLifetimeDays: number; maxTotalTokens: number; maxTicks: number },
): { expired: true; reason: string } | { expired: false } {
  const ageDays = (Date.now() - run.startedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays > agent.maxLifetimeDays) return { expired: true, reason: `lifetime > ${agent.maxLifetimeDays}d` };
  if (run.totalTokens >= agent.maxTotalTokens) return { expired: true, reason: `tokens >= ${agent.maxTotalTokens}` };
  if (run.tickCount >= agent.maxTicks) return { expired: true, reason: `ticks >= ${agent.maxTicks}` };
  return { expired: false };
}

export const agentRunStart = inngest.createFunction(
  { id: "agent-run-start", retries: 3, triggers: [{ event: "agent/run.start" }] },
  async ({ event, step }) => {
    const { agentId, userId, runId: preCreatedRunId } = event.data as { agentId: string; userId: string; runId?: string };
    const run = await step.run("create-or-load-run", async () => {
      if (preCreatedRunId) {
        const existing = await prisma.agentRun.findUnique({ where: { id: preCreatedRunId } });
        if (existing) {
          // Backfill aepId on pre-created runs that lack one, so event payloads
          // carry stable AEP identifiers.
          if (!existing.aepId) {
            const updated = await prisma.agentRun.update({
              where: { id: existing.id },
              data: { aepId: newAepId("run") },
            });
            return updated;
          }
          return existing;
        }
      }
      // Snapshot inputs at run start so a future "Replay this run" can
      // re-execute with the EXACT knowledge sources + memory state the
      // agent saw originally. systemPromptUsed is filled by the runner on
      // the first tick (it's built per-cycle, not at creation time).
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        select: { aepId: true },
      });
      const knowledgeSources = await prisma.agentKnowledgeSource.findMany({
        where: { agentId, status: "ready" },
        select: { id: true },
      });
      const knowledgeSourceIds = knowledgeSources.map((k) => k.id);
      let memorySnapshotJson: Record<string, unknown> | null = null;
      if (agent?.aepId) {
        const memoryRows = await prisma.aepMemoryRecord.findMany({
          where: { treeRootId: agent.aepId },
        });
        memorySnapshotJson = memoryRows.reduce<Record<string, unknown>>((acc, m) => {
          acc[`${m.namespace}/${m.key}`] = m.value as unknown;
          return acc;
        }, {});
      }
      return prisma.agentRun.create({
        data: {
          agentId,
          userId,
          status: "pending",
          aepId: newAepId("run"),
          knowledgeSourceIds,
          memorySnapshotJson: (memorySnapshotJson ?? undefined) as never,
        },
      });
    });
    // Load the agent's AEP id for the run.started payload (best-effort).
    try {
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        select: { aepId: true },
      });
      emitAep(run.id, "run.started", {
        run_id: run.aepId ?? run.id,
        agent_id: agent?.aepId ?? agentId,
      });
    } catch (err) {
      console.warn(`[aep] run.started lookup failed for run ${run.id}:`, err);
    }
    await inngest.send({ name: "agent/run.tick", data: { runId: run.id } });
    return { runId: run.id };
  },
);

export const agentRunTick = inngest.createFunction(
  { id: "agent-run-tick", retries: 3, triggers: [{ event: "agent/run.tick" }] },
  async ({ event, step }) => {
    const { runId } = event.data as { runId: string };
    const run = await step.run("load-run", () =>
      prisma.agentRun.findUnique({ where: { id: runId }, include: { agent: true } }),
    );
    if (!run) return { skipped: "run not found" };
    if (["stopped", "completed", "expired", "aborted"].includes(run.status)) return { skipped: `terminal:${run.status}` };
    if (run.agent.deletedAt) {
      await prisma.agentRun.update({ where: { id: runId }, data: { status: "stopped" } });
      emitAep(runId, "run.ended", {
        run_id: run.aepId ?? run.id,
        final_state: "stopped",
        result: { reason: "agent deleted" },
      });
      return { skipped: "agent deleted" };
    }

    const lifetime = checkLifetimeCaps(
      { startedAt: new Date(run.startedAt), totalTokens: run.totalTokens, tickCount: run.tickCount },
      run.agent,
    );
    if (lifetime.expired) {
      await prisma.agentRun.update({
        where: { id: runId },
        data: { status: "expired", completedAt: new Date(), finalMessage: `expired: ${lifetime.reason}` },
      });
      emitAep(runId, "run.ended", {
        run_id: run.aepId ?? run.id,
        final_state: "expired",
        result: { reason: lifetime.reason },
      });
      return { expired: lifetime.reason };
    }

    const tickNumber = run.tickCount + 1;
    const outcome = await runOneCycle({ agentId: run.agentId, runId, tickNumber });

    if (outcome.kind === "slept" || outcome.kind === "forced_sleep") {
      await step.sleepUntil("sleep-until-wake", outcome.nextWakeAt);
      await inngest.send({ name: "agent/run.tick", data: { runId } });
    } else if (outcome.kind === "continue") {
      await inngest.send({ name: "agent/run.tick", data: { runId } });
    }
    return outcome;
  },
);
