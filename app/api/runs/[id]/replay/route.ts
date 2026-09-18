import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { newAepId } from "@/lib/aep/ids";

/**
 * Replay an existing AgentRun with its EXACT snapshotted system prompt +
 * memory + knowledge source IDs. The replay run is marked with
 * parentRunId = original so the audit trail can correlate the two; future
 * v1.1 work will add a "replay-only" flag enforcing read-only memory.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const original = await prisma.agentRun.findUnique({
    where: { id },
    include: { agent: { select: { id: true, userId: true } } },
  });
  if (!original) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (original.agent.userId !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!original.systemPromptUsed) {
    return NextResponse.json(
      { error: "no_snapshot_available", message: "This run has no captured system prompt — replay only works for runs created after the financial-agents v1 snapshot was added." },
      { status: 400 },
    );
  }

  const replay = await prisma.agentRun.create({
    data: {
      agentId: original.agentId,
      userId: original.userId,
      status: "pending",
      aepId: newAepId("run"),
      parentRunId: original.id,
      systemPromptUsed: original.systemPromptUsed,
      memorySnapshotJson: original.memorySnapshotJson ?? undefined,
      knowledgeSourceIds: original.knowledgeSourceIds,
    },
  });

  await inngest.send({
    name: "agent/run.start",
    data: { agentId: original.agentId, runId: replay.id, userId: original.userId },
  });

  return NextResponse.json({ replayRunId: replay.id });
}
