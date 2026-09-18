import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getPageIndexClient } from "@/lib/agents/knowledge/pageindex-client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const { id: agentId, sourceId } = await params;

  const source = await prisma.agentKnowledgeSource.findFirst({
    where: { id: sourceId, agentId, userId },
  });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (source.lane !== "pageindex" || !source.pageindexDocId) {
    return NextResponse.json({ error: "Tree preview only available for PDFs" }, { status: 400 });
  }

  try {
    const tree = await getPageIndexClient().api.getTree(source.pageindexDocId, {
      nodeSummary: true,
    });
    return NextResponse.json({ tree });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "PageIndex error" },
      { status: 502 },
    );
  }
}
