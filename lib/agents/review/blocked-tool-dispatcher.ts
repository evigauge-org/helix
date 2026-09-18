import { prisma } from "@/lib/prisma";
import { toolRegistry } from "@/lib/agents/tool-registry";
import type { ToolContext } from "@/lib/agents/types";

type BlockedCall = { toolSlug: string; args: unknown; proposedAt: string; callId: string };

/**
 * Called by POST /api/reviews/:id/decide when a review transitions to
 * "approved". Walks blockedToolCallsJson, dispatches each tool, and writes
 * a tool_post_approval AgentStep row per call. Failures are logged but do
 * NOT block the rest from dispatching.
 */
export async function dispatchBlockedToolCalls(args: {
  runId: string;
  agentId: string;
  userId: string;
  approverId: string;
}): Promise<{ dispatched: number; failed: number }> {
  const review = await prisma.agentRunReview.findUnique({ where: { runId: args.runId } });
  if (!review || review.status !== "approved") return { dispatched: 0, failed: 0 };
  const calls = (review.blockedToolCallsJson as BlockedCall[] | null) ?? [];
  if (calls.length === 0) return { dispatched: 0, failed: 0 };

  let dispatched = 0;
  let failed = 0;

  for (const c of calls) {
    const tool = toolRegistry.get(c.toolSlug);
    if (!tool) {
      failed++;
      await prisma.agentStep.create({
        data: {
          runId: args.runId,
          tickNumber: 0,
          stepNumber: 0,
          kind: "tool_post_approval",
          toolSlug: c.toolSlug,
          payload: { callId: c.callId, ok: false, error: "tool not registered" },
        },
      });
      continue;
    }
    const ctx: ToolContext = {
      userId: args.userId,
      agentId: args.agentId,
      runId: args.runId,
      tickNumber: 0,
      log: () => {},
    };
    try {
      const result = await tool.execute(ctx, c.args as never);
      const ok = result.ok;
      const payload: Record<string, unknown> = { callId: c.callId, ok };
      if (ok) payload.data = result.data ?? null;
      else payload.error = result.error;
      await prisma.agentStep.create({
        data: {
          runId: args.runId,
          tickNumber: 0,
          stepNumber: 0,
          kind: "tool_post_approval",
          toolSlug: c.toolSlug,
          payload: payload as object,
        },
      });
      if (ok) dispatched++;
      else failed++;
    } catch (e) {
      failed++;
      await prisma.agentStep.create({
        data: {
          runId: args.runId,
          tickNumber: 0,
          stepNumber: 0,
          kind: "tool_post_approval",
          toolSlug: c.toolSlug,
          payload: { callId: c.callId, ok: false, error: e instanceof Error ? e.message : "unknown error" },
        },
      });
    }
  }
  return { dispatched, failed };
}
