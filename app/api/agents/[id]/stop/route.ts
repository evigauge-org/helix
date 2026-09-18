import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { collectSubtreeIds, NON_TERMINAL_STATUSES } from "../_subtree";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;

  const agent = await prisma.agent.findUnique({ where: { id }, select: { userId: true } });
  if (!agent) return new Response("Not found", { status: 404 });
  if (agent.userId !== session.user.id) return new Response("Forbidden", { status: 403 });

  const ids = await collectSubtreeIds(id);

  await prisma.agent.updateMany({
    where: { id: { in: ids } },
    data: { selfModLocked: true, replicationLocked: true },
  });

  await prisma.agentRun.updateMany({
    where: { agentId: { in: ids }, status: { in: NON_TERMINAL_STATUSES } },
    data: { status: "stopped" },
  });

  return Response.json({ stopped: ids.length });
}
