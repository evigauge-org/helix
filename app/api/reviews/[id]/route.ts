import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const review = await prisma.agentRunReview.findUnique({
    where: { id },
    include: {
      agent: { select: { id: true, name: true, userId: true, templateSlug: true } },
      run: {
        select: {
          id: true,
          startedAt: true,
          completedAt: true,
          knowledgeSourceIds: true,
        },
      },
      approver: { select: { id: true, name: true } },
    },
  });
  if (!review) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (review.agent.userId !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const steps = await prisma.agentStep.findMany({
    where: { runId: review.runId },
    orderBy: [{ tickNumber: "asc" }, { stepNumber: "asc" }],
  });

  return NextResponse.json({ review, steps });
}
