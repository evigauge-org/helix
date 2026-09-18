import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const templateSlug = url.searchParams.get("templateSlug");
  const agentId = url.searchParams.get("agentId");
  const sinceDays = url.searchParams.get("sinceDays");

  const where: Record<string, unknown> = {
    agent: { userId: session.user.id },
  };
  if (status) where.status = status;
  if (templateSlug) where.templateSlug = templateSlug;
  if (agentId) where.agentId = agentId;
  if (sinceDays) {
    const d = new Date();
    d.setDate(d.getDate() - Number(sinceDays));
    where.createdAt = { gte: d };
  }

  const reviews = await prisma.agentRunReview.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      runId: true,
      agentId: true,
      templateSlug: true,
      templateVersion: true,
      status: true,
      outputSummary: true,
      decisionAt: true,
      createdAt: true,
      agent: { select: { name: true } },
    },
  });
  return NextResponse.json({ reviews });
}
