import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

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

  await prisma.agentRun.update({
    where: { id },
    data: { status: "stopped" },
  });

  return Response.json({ stopped: true });
}
