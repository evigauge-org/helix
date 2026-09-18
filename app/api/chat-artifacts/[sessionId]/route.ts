import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sessionId } = await params;

  const chat = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });
  if (!chat || chat.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await prisma.$queryRaw<Array<{ runId: string; agentId: string | null }>>(
    Prisma.sql`
      SELECT DISTINCT
        ("metadata"->'agent_post'->>'runId')  AS "runId",
        ("metadata"->'agent_post'->>'agentId') AS "agentId"
      FROM "ChatMessage"
      WHERE "chatSessionId" = ${sessionId}
        AND "metadata"->'agent_post'->>'runId' IS NOT NULL
    `,
  );

  const runIds = Array.from(new Set(rows.map((r) => r.runId).filter(Boolean)));
  if (runIds.length === 0) {
    return NextResponse.json({ artifacts: [] });
  }

  const artifacts = await prisma.agentArtifact.findMany({
    where: {
      runId: { in: runIds },
      run: { agent: { userId: session.user.id } },
    },
    select: {
      id: true,
      name: true,
      mimeType: true,
      createdAt: true,
      runId: true,
      run: { select: { agent: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const shaped = artifacts.map((a) => ({
    id: a.id,
    name: a.name,
    mimeType: a.mimeType,
    createdAt: a.createdAt,
    runId: a.runId,
    agentId: a.run.agent.id,
    agentName: a.run.agent.name,
  }));

  return NextResponse.json({ artifacts: shaped });
}
