import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { collectSubtreeIds } from "../_subtree";

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
    data: { selfModLocked: false, replicationLocked: false },
  });

  return Response.json({ resumed: ids.length });
}
