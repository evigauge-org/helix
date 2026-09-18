import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const { id: agentId } = await params;

  const agent = await prisma.agent.findFirst({
    where: { id: agentId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sources = await prisma.agentKnowledgeSource.findMany({
    where: { userId, agentId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ sources });
}
