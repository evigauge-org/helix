import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;

  const run = await prisma.agentRun.findUnique({
    where: { id },
    include: { agent: { select: { userId: true } } },
  });
  if (!run) return new Response("Not found", { status: 404 });
  if (run.agent.userId !== session.user.id) return new Response("Forbidden", { status: 403 });

  if (run.status !== "idle") {
    return Response.json({ error: `Cannot wake: status is ${run.status}` }, { status: 400 });
  }

  await prisma.agentRun.update({
    where: { id },
    data: { status: "pending", nextWakeAt: null },
  });

  await inngest.send({ name: "agent/run.tick", data: { runId: id } });

  return Response.json({ woken: true });
}
