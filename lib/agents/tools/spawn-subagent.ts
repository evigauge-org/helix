// lib/agents/tools/spawn-subagent.ts
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { newAepId } from "@/lib/aep/ids";
import { emitAepEvent } from "@/lib/aep/events";
import type { ToolDef, ToolContext, ToolResult } from "../types";

// Walks parentRunId chain upward to count how deep the current run is. Depth 0
// = top-level run with no parent. Capped to prevent runaway loops.
async function getRunDepth(runId: string): Promise<number> {
  let depth = 0;
  let current: { parentRunId: string | null } | null = await prisma.agentRun.findUnique({
    where: { id: runId },
    select: { parentRunId: true },
  });
  while (current?.parentRunId) {
    depth++;
    current = await prisma.agentRun.findUnique({
      where: { id: current.parentRunId },
      select: { parentRunId: true },
    });
    if (depth > 10) break;
  }
  return depth;
}

// Pull spawnSubagent.maxDepth from the agent's template policy. Defaults to 2
// when the agent has no template (matches Anthropic's depth-1 leaf-worker
// pattern but allows one extra level for harder workflows).
async function getMaxSubagentDepth(agentId: string): Promise<number> {
  const a = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { template: { select: { selfImprovementPolicyJson: true } } },
  });
  const pol = (a?.template?.selfImprovementPolicyJson ?? null) as
    | { spawnSubagent?: { maxDepth?: number } }
    | null;
  return pol?.spawnSubagent?.maxDepth ?? 2;
}

const schema = z.object({
  name: z.string(),
  constitution: z.object({
    immutable_directives: z.string(),
    mutable_prompt: z.string(),
    mutable_prompt_policy: z.enum(["auto", "approval_required", "locked"]).default("auto"),
  }),
  toolset_subset: z.array(z.string()),
  initial_goal: z.string(),
  ceilings: z.object({
    max_cycles: z.number().int().positive(),
    max_subagents: z.number().int().nonnegative(),
    max_tool_calls_per_cycle: z.number().int().positive(),
    max_wall_seconds: z.number().int().positive(),
  }),
  budgets: z.object({
    tokens_per_cycle: z.number().int().positive(),
    tool_calls_per_cycle: z.number().int().positive(),
    seconds_per_cycle: z.number().int().positive(),
  }),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const spawnSubagentTool: ToolDef = {
  slug: "spawn_subagent",
  description: "Create a child agent in this agent's tree and start an initial run with the provided goal.",
  schema,
  async execute(ctx: ToolContext, rawArgs: unknown): Promise<ToolResult> {
    const args = schema.parse(rawArgs);
    const parent = await prisma.agent.findUnique({ where: { id: ctx.agentId } });
    if (!parent) return { ok: false, error: "parent missing" };

    // Depth check from template policy. Walks ctx.runId's parentRunId chain
    // and refuses to spawn if depth+1 would exceed maxDepth.
    const currentDepth = await getRunDepth(ctx.runId);
    const maxDepth = await getMaxSubagentDepth(ctx.agentId);
    if (currentDepth + 1 > maxDepth) {
      return { ok: false, error: `max subagent depth (${maxDepth}) exceeded` };
    }

    // Validate ceilings do not exceed parent headroom.
    const parentCeilings = (parent.ceilingsJson as any) ?? {};
    for (const k of ["max_cycles", "max_subagents", "max_tool_calls_per_cycle", "max_wall_seconds"] as const) {
      const p = (parentCeilings as any)[k];
      if (typeof p === "number" && (args.ceilings as any)[k] > p) {
        return { ok: false, error: `ceiling_exceeded: child ${k} exceeds parent` };
      }
    }
    // Validate toolset_subset ⊆ parent.toolset
    const parentTools = new Set((parent.toolset ?? []).length ? parent.toolset : parent.toolSlugs.map(s => `helix.${s}`));
    for (const t of args.toolset_subset) {
      if (!parentTools.has(t)) return { ok: false, error: `tool_not_found: ${t} not in parent toolset` };
    }

    // Legacy required columns: createdBy + constitutionVersion must be set (mirrors agent.create handler from Task 8).
    const constitution = await prisma.systemConstitution.findFirst({ orderBy: { version: "desc" } });
    if (!constitution) return { ok: false, error: "lifecycle_conflict: SystemConstitution not initialized" };

    const childAepId = newAepId("agt");
    const child = await prisma.agent.create({
      data: {
        userId: parent.userId,
        name: args.name,
        goal: args.initial_goal,
        toolSlugs: args.toolset_subset.map(t => t.replace(/^helix\./, "")),
        toolset: args.toolset_subset,
        systemPromptExtra: args.constitution.mutable_prompt,
        constitutionImmutable: args.constitution.immutable_directives,
        constitutionMutable: args.constitution.mutable_prompt,
        constitutionPolicy: args.constitution.mutable_prompt_policy,
        ceilingsJson: args.ceilings as any,
        budgetsJson: args.budgets as any,
        aepMetadata: (args.metadata as any) ?? undefined,
        aepId: childAepId,
        parentAgentId: parent.aepId,
        rootAgentId: parent.rootAgentId,
        createdBy: "aep",                                 // legacy required column
        constitutionVersion: constitution.version,        // legacy required column; pulled from live SystemConstitution
        maxStepsPerCycle: args.ceilings.max_tool_calls_per_cycle * 2,
        maxCycleDurationSecs: args.budgets.seconds_per_cycle,
        maxTokensPerCycle: args.budgets.tokens_per_cycle,
        maxTicks: args.ceilings.max_cycles,
        maxLifetimeDays: Math.ceil(args.ceilings.max_wall_seconds / 86400),
        maxTotalTokens: args.ceilings.max_cycles * args.budgets.tokens_per_cycle,
      },
    });

    const childRunAepId = newAepId("run");
    const childRun = await prisma.agentRun.create({
      data: {
        agentId: child.id,
        userId: parent.userId,
        status: "pending",
        aepId: childRunAepId,
        aepState: "running",
        parentRunId: ctx.runId,
      },
    });

    await emitAepEvent(ctx.runId, "subagent.spawned", { child_agent_id: childAepId, child_run_id: childRunAepId });
    await inngest.send({ name: "agent/run.start", data: { agentId: child.id, runId: childRun.id, userId: parent.userId } });
    return { ok: true, data: { child_agent_id: childAepId, child_run_id: childRunAepId } };
  },
};
