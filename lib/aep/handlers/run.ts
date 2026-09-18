// lib/aep/handlers/run.ts
import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { newAepId } from "../ids";
import { AepError } from "../errors";
import type { AepContext } from "../context";

export async function runCreate(
  params: { agent_id: string; goal: string; inputs?: Record<string, unknown>; subject_ids?: string[] },
  ctx: AepContext,
) {
  const a = await prisma.agent.findFirst({ where: { aepId: params.agent_id, userId: ctx.userId } });
  if (!a) throw new AepError("tool_not_found", "Agent not found");
  const aepId = newAepId("run");
  // AgentRun has no `goal` column in this schema; per-run goal lives on the
  // Agent row while the run is active. Acceptable MVP compromise — runs are
  // expected to start serially per agent.
  const run = await prisma.agentRun.create({
    data: {
      agentId: a.id,
      userId: ctx.userId,
      status: "pending",
      aepId,
      aepState: "running",
      subjectIds: params.subject_ids ?? [],
      aepMetadata: (params.inputs as any) ?? undefined,
    },
  });
  await prisma.agent.update({ where: { id: a.id }, data: { goal: params.goal } });
  await inngest.send({ name: "agent/run.start", data: { agentId: a.id, runId: run.id, userId: ctx.userId } });
  return serializeRun(run, a.aepId!, params.goal);
}

export async function runGet(params: { run_id: string }, ctx: AepContext) {
  const r = await prisma.agentRun.findFirst({ where: { aepId: params.run_id, userId: ctx.userId }, include: { agent: true } });
  if (!r) throw new AepError("tool_not_found", "Run not found");
  return serializeRun(r, r.agent.aepId!, r.agent.goal);
}

export async function runList(
  params: { agent_id: string; cursor?: string; limit?: number },
  ctx: AepContext,
) {
  const a = await prisma.agent.findFirst({ where: { aepId: params.agent_id, userId: ctx.userId } });
  if (!a) throw new AepError("tool_not_found", "Agent not found");
  const take = Math.min(params.limit ?? 50, 200);
  const rows = await prisma.agentRun.findMany({
    where: { agentId: a.id },
    orderBy: { startedAt: "desc" },
    take: take + 1,
    ...(params.cursor ? { cursor: { aepId: params.cursor }, skip: 1 } : {}),
  });
  const next_cursor = rows.length > take ? rows[take - 1].aepId : null;
  return { runs: rows.slice(0, take).map(r => serializeRun(r, a.aepId!, a.goal)), next_cursor };
}

export async function runCancel(params: { run_id: string }, ctx: AepContext) {
  const r = await prisma.agentRun.findFirst({ where: { aepId: params.run_id, userId: ctx.userId } });
  if (!r) throw new AepError("tool_not_found", "Run not found");
  await prisma.agentRun.update({ where: { id: r.id }, data: { aepState: "cancelled", status: "stopped", completedAt: new Date() } });
  return { ok: true };
}

export async function runContinue(params: { run_id: string }, ctx: AepContext) {
  const r = await prisma.agentRun.findFirst({ where: { aepId: params.run_id, userId: ctx.userId }, include: { agent: true } });
  if (!r) throw new AepError("tool_not_found", "Run not found");
  if (r.aepState !== "sleeping") throw new AepError("lifecycle_conflict", `Run is ${r.aepState}, not sleeping`);
  await prisma.agentRun.update({ where: { id: r.id }, data: { aepState: "running", status: "pending", nextWakeAt: null } });
  await inngest.send({ name: "agent/run.tick", data: { runId: r.id } });
  return { ok: true };
}

function serializeRun(r: any, agentAepId: string, goal: string) {
  return {
    id: r.aepId,
    agent_id: agentAepId,
    goal,
    state: r.aepState,
    result: r.aepResult ?? null,
    started_at: r.startedAt.toISOString(),
    ended_at: r.completedAt?.toISOString() ?? null,
    cycle_count: r.cycleCount,
    subject_ids: r.subjectIds ?? [],
    metadata: r.aepMetadata ?? {},
  };
}
