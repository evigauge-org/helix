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
  const userId = session.user.id;
  const { id } = await params;

  const agent = await prisma.agent.findUnique({ where: { id }, select: { userId: true } });
  if (!agent) return new Response("Not found", { status: 404 });
  if (agent.userId !== userId) return new Response("Forbidden", { status: 403 });

  await inngest.send({ name: "agent/run.start", data: { agentId: id, userId } });

  return Response.json({ queued: true });
}
