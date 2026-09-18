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
  const userId = session.user.id;
  const { id } = await params;

  const agent = await prisma.agent.findUnique({ where: { id }, select: { userId: true } });
  if (!agent) return new Response("Not found", { status: 404 });
  if (agent.userId !== userId) return new Response("Forbidden", { status: 403 });

  const ids = await collectSubtreeIds(id);

  await prisma.agentRun.updateMany({
    where: { agentId: { in: ids }, status: { in: NON_TERMINAL_STATUSES } },
    data: { status: "stopped" },
  });

  await prisma.agent.deleteMany({ where: { id: { in: ids } } });

  await prisma.agentAuditTrail.create({
    data: {
      userId,
      action: "deleted_subtree",
      rootAgentIdDeleted: id,
      descendantCount: ids.length - 1,
    },
  });

  return Response.json({ deleted: ids.length });
}
