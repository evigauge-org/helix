import { z } from "zod";
import { registerTool } from "../tool-registry";
import type { ToolDef } from "../types";
import { prisma } from "@/lib/prisma";

const MAX_DEPTH = 5;
const MAX_CHILDREN_PER_PARENT = 10;
const MAX_SPAWN_PER_24H = 3;
const PER_USER_AGENT_CAP = 100;

const schema = z.object({
  child_goal: z.string().min(1).max(4000),
  child_name: z.string().min(1).max(100),
  child_tools: z.array(z.string()).max(6),
  budget_tokens: z.number().int().positive(),
  budget_ticks: z.number().int().positive(),
  genesis_prompt: z.string().max(4000).optional(),
});

async function computeTreeDepth(parentId: string): Promise<number> {
  // Depth = number of ancestors above the root. Root has depth 0.
  // We walk upward from `parentId`. The new child's depth would be (parent depth + 1).
  let depth = 0;
  let currentId: string | null = parentId;
  for (let i = 0; i < 7; i++) {
    if (!currentId) break;
    const node: { parentAgentId: string | null } | null =
      await prisma.agent.findUnique({
        where: { id: currentId },
        select: { parentAgentId: true },
      });
    if (!node || !node.parentAgentId) break;
    depth += 1;
    currentId = node.parentAgentId;
  }
  return depth;
}

const replicateTool: ToolDef<typeof schema> = {
  slug: "replicate",
  description:
    "Spawn a child agent that inherits your Constitution and a portion of your remaining budget. Max tree depth 5, max 10 children/parent, max 3 children/24h.",
  schema,
  async execute(ctx, args) {
    const parent = await prisma.agent.findUnique({
      where: { id: ctx.agentId },
      include: {
        hardCeiling: true,
        runs: { select: { totalTokens: true, tickCount: true } },
      },
    });
    if (!parent) return { ok: false, error: "agent not found" };
    if (parent.deletedAt) return { ok: false, error: "agent deleted" };
    if (parent.replicationLocked) {
      return { ok: false, error: "replication halted by user" };
    }
    if (!parent.hardCeiling) {
      return { ok: false, error: "no hard ceiling configured" };
    }

    // Depth check (parent depth + 1 = new child depth, must be < MAX_DEPTH)
    const parentDepth = await computeTreeDepth(parent.id);
    if (parentDepth + 1 >= MAX_DEPTH) {
      return { ok: false, error: `max tree depth ${MAX_DEPTH} reached` };
    }

    // Lifetime children per parent
    const childrenCount = await prisma.agent.count({
      where: { parentAgentId: parent.id },
    });
    if (childrenCount >= MAX_CHILDREN_PER_PARENT) {
      return {
        ok: false,
        error: `max children per parent (${MAX_CHILDREN_PER_PARENT}) reached`,
      };
    }

    // Children spawned in last 24h by this parent
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentChildren = await prisma.agent.count({
      where: { parentAgentId: parent.id, createdAt: { gt: dayAgo } },
    });
    if (recentChildren >= MAX_SPAWN_PER_24H) {
      return {
        ok: false,
        error: `replication rate limit: ${MAX_SPAWN_PER_24H}/24h`,
      };
    }

    // User-wide agent cap (excluding deleted)
    const userAgentCount = await prisma.agent.count({
      where: { userId: parent.userId, deletedAt: null },
    });
    if (userAgentCount >= PER_USER_AGENT_CAP) {
      return {
        ok: false,
        error: `per-user agent cap (${PER_USER_AGENT_CAP}) reached`,
      };
    }

    // Budget check
    const totalTokensUsed = parent.runs.reduce(
      (s, r) => s + (r.totalTokens ?? 0),
      0,
    );
    const totalTicksUsed = parent.runs.reduce(
      (s, r) => s + (r.tickCount ?? 0),
      0,
    );
    const remainingTokens = parent.maxTotalTokens - totalTokensUsed;
    const remainingTicks = parent.maxTicks - totalTicksUsed;
    if (args.budget_tokens > remainingTokens) {
      return {
        ok: false,
        error: `budget_tokens ${args.budget_tokens} exceeds remaining ${remainingTokens}`,
      };
    }
    if (args.budget_ticks > remainingTicks) {
      return {
        ok: false,
        error: `budget_ticks ${args.budget_ticks} exceeds remaining ${remainingTicks}`,
      };
    }

    // Tool inheritance validation
    const parentToolSet = new Set(parent.toolSlugs);
    for (const slug of args.child_tools) {
      if (!parentToolSet.has(slug)) {
        return {
          ok: false,
          error: `tool '${slug}' is not in parent's toolSlugs`,
        };
      }
    }

    // Atomic create: child agent + hard ceiling
    const child = await prisma.$transaction(async (tx) => {
      const created = await tx.agent.create({
        data: {
          userId: parent.userId,
          name: args.child_name,
          goal: args.child_goal,
          systemPromptExtra: args.genesis_prompt ?? null,
          toolSlugs: args.child_tools,
          runnerModel: parent.runnerModel,
          maxStepsPerCycle: parent.maxStepsPerCycle,
          maxCycleDurationSecs: parent.maxCycleDurationSecs,
          maxTokensPerCycle: parent.maxTokensPerCycle,
          maxLifetimeDays: parent.maxLifetimeDays,
          maxTotalTokens: args.budget_tokens,
          maxTicks: args.budget_ticks,
          createdBy: "agent",
          createdInChatId: parent.createdInChatId,
          parentAgentId: parent.id,
          rootAgentId: parent.rootAgentId,
          constitutionVersion: parent.constitutionVersion,
          selfModLocked: false,
          replicationLocked: false,
        },
      });
      await tx.agentHardCeiling.create({
        data: {
          agentId: created.id,
          maxStepsPerCycleCeiling: parent.hardCeiling!.maxStepsPerCycleCeiling,
          maxCycleDurationCeiling: parent.hardCeiling!.maxCycleDurationCeiling,
          maxTokensPerCycleCeiling:
            parent.hardCeiling!.maxTokensPerCycleCeiling,
          maxLifetimeDaysCeiling: parent.hardCeiling!.maxLifetimeDaysCeiling,
          maxTotalTokensCeiling: args.budget_tokens,
          maxTicksCeiling: args.budget_ticks,
        },
      });
      return created;
    });

    // Record modification on parent
    await prisma.agentModification.create({
      data: {
        agentId: parent.id,
        tickNumber: ctx.tickNumber,
        tool: "replicate",
        before: null as never,
        after: {
          childId: child.id,
          budget_tokens: args.budget_tokens,
          budget_ticks: args.budget_ticks,
          goal: args.child_goal,
        } as never,
      },
    });

    // Kick off the child run via Inngest (dynamic import to avoid circular deps)
    try {
      const { inngest } = await import("@/inngest/client");
      await inngest.send({
        name: "agent/run.start",
        data: { agentId: child.id, userId: parent.userId },
      });
    } catch (err) {
      ctx.log("replicate: failed to dispatch agent/run.start", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return { ok: true, data: { childId: child.id, name: child.name } };
  },
};

registerTool(replicateTool);
