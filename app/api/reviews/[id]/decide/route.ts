import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { dispatchBlockedToolCalls } from "@/lib/agents/review/blocked-tool-dispatcher";
import { updateRunAuditLogOnDecision } from "@/lib/agents/audit/run-audit-log";

const Body = z.object({
  decision: z.enum(["approved", "changes_requested", "rejected"]),
  note: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = Body.parse(await req.json());

  const review = await prisma.agentRunReview.findUnique({
    where: { id },
    include: { agent: { select: { id: true, userId: true } } },
  });
  if (!review) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (review.agent.userId !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (review.status !== "pending") {
    return NextResponse.json(
      { error: "already_decided", status: review.status, decisionAt: review.decisionAt },
      { status: 409 },
    );
  }

  const decisionAt = new Date();
  await prisma.agentRunReview.update({
    where: { id: review.id },
    data: {
      status: body.decision,
      decisionNote: body.note ?? null,
      approverId: session.user.id,
      decisionAt,
    },
  });
  await updateRunAuditLogOnDecision({
    runId: review.runId,
    reviewStatus: body.decision,
    approverId: session.user.id,
    decisionAt,
  });

  let dispatchResult: { dispatched: number; failed: number } | null = null;
  if (body.decision === "approved") {
    dispatchResult = await dispatchBlockedToolCalls({
      runId: review.runId,
      agentId: review.agentId,
      userId: session.user.id,
      approverId: session.user.id,
    });
  }

  return NextResponse.json({ ok: true, dispatch: dispatchResult });
}
