import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;

  const run = await prisma.agentRun.findUnique({
    where: { id },
    include: {
      agent: { select: { userId: true, name: true } },
      artifacts: true,
    },
  });
  if (!run) return new Response("Not found", { status: 404 });
  if (run.agent.userId !== session.user.id) return new Response("Forbidden", { status: 403 });

  const since = req.nextUrl.searchParams.get("since");
  let sinceDate: Date | null = null;
  if (since) {
    const step = await prisma.agentStep.findUnique({
      where: { id: since },
      select: { createdAt: true },
    });
    if (step) sinceDate = step.createdAt;
  }

  const newSteps = await prisma.agentStep.findMany({
    where: {
      runId: id,
      ...(sinceDate ? { createdAt: { gt: sinceDate } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return Response.json({ run, newSteps });
}
