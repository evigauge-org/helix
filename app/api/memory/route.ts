import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

// GET — build memory graph from user's query history
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const queries = await prisma.queryHistory.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      query: true,
      tier: true,
      confidence: true,
      agentsUsed: true,
      createdAt: true,
    },
  });

  // Extract topics/entities from queries
  const topicCounts: Record<string, number> = {};
  const tierCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const timeline: { date: string; count: number }[] = [];
  const dateMap: Record<string, number> = {};

  for (const q of queries) {
    // Simple keyword extraction
    const words = q.query.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    for (const w of words) {
      topicCounts[w] = (topicCounts[w] ?? 0) + 1;
    }
    tierCounts[q.tier] = (tierCounts[q.tier] ?? 0) + 1;

    const day = new Date(q.createdAt).toISOString().slice(0, 10);
    dateMap[day] = (dateMap[day] ?? 0) + 1;
  }

  // Top topics
  const topics = Object.entries(topicCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([topic, count]) => ({ topic, count }));

  // Timeline
  for (const [date, count] of Object.entries(dateMap).sort()) {
    timeline.push({ date, count });
  }

  return NextResponse.json({
    totalQueries: queries.length,
    topics,
    tierCounts,
    timeline,
    recentQueries: queries.slice(0, 10).map((q) => ({
      id: q.id,
      query: q.query,
      tier: q.tier,
      confidence: q.confidence,
      date: q.createdAt,
    })),
  });
}
