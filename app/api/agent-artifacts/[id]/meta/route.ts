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
  const { id } = await params;

  const artifact = await prisma.agentArtifact.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      mimeType: true,
      createdAt: true,
      runId: true,
      run: { select: { agent: { select: { id: true, userId: true, name: true } } } },
    },
  });
  if (!artifact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (artifact.run.agent.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    id: artifact.id,
    name: artifact.name,
    mimeType: artifact.mimeType,
    createdAt: artifact.createdAt,
    runId: artifact.runId,
    agentId: artifact.run.agent.id,
    agentName: artifact.run.agent.name,
  });
}
