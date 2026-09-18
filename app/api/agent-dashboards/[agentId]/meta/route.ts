import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { agentId } = await params;
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { userId: true },
  });
  if (!agent || agent.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const dash = await prisma.agentDashboard.findUnique({
    where: { agentId },
    select: { updatedAt: true, title: true },
  });
  if (!dash) return NextResponse.json({ error: "No dashboard" }, { status: 404 });
  return NextResponse.json({ updatedAt: dash.updatedAt.toISOString(), title: dash.title });
}
