import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getPageIndexClient } from "@/lib/agents/knowledge/pageindex-client";

const PatchSchema = z.object({
  filename: z.string().min(1).max(500),
});

async function loadOwned(userId: string, agentId: string, sourceId: string) {
  return prisma.agentKnowledgeSource.findFirst({
    where: { id: sourceId, agentId, userId },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const { id: agentId, sourceId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 400 });
  }

  const existing = await loadOwned(userId, agentId, sourceId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.agentKnowledgeSource.update({
    where: { id: sourceId },
    data: { filename: parsed.data.filename },
  });
  return NextResponse.json({ source: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const { id: agentId, sourceId } = await params;

  const existing = await loadOwned(userId, agentId, sourceId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.lane === "pageindex" && existing.pageindexDocId) {
    try {
      await getPageIndexClient().api.deleteDocument(existing.pageindexDocId);
    } catch (err) {
      console.warn(`[agent-knowledge] PageIndex deleteDocument failed for ${existing.pageindexDocId}:`, err);
    }
  }

  await prisma.agentKnowledgeSource.delete({ where: { id: sourceId } });
  return NextResponse.json({ ok: true });
}
