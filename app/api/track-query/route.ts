import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { query, answer, tier, tokensUsed, cost, latencyMs, confidence, agentsUsed, cached } = body;

  try {
    const record = await prisma.queryHistory.create({
      data: {
        userId: session.user.id,
        query: query ?? "",
        tier: tier ?? 0,
        response: answer ?? "",
        tokensUsed: tokensUsed ?? 0,
        cost: cost ?? 0,
        latencyMs: latencyMs ?? 0,
        confidence: confidence ?? 0,
        agentsUsed: agentsUsed ?? ["openrouter/gemma-3-27b-it"],
        cached: cached ?? false,
      },
    });

    return NextResponse.json({ id: record.id });
  } catch (error) {
    console.error("Failed to track query:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
