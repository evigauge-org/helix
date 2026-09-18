import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { autoPopulate } from "@/lib/agents/auto-populate/dispatch";

const BodySchema = z.object({
  draftToken: z.string().optional(),
  agentId: z.string().optional(),
  userPromptHint: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 400 });
  }
  if (!parsed.data.agentId && !parsed.data.draftToken) {
    return NextResponse.json({ error: "Provide agentId OR draftToken" }, { status: 400 });
  }

  const sources = await prisma.agentKnowledgeSource.findMany({
    where: parsed.data.agentId
      ? { agentId: parsed.data.agentId, userId, status: "ready" }
      : { draftToken: parsed.data.draftToken!, userId, status: "ready" },
    orderBy: { createdAt: "asc" },
  });
  if (sources.length === 0) {
    return NextResponse.json(
      { error: "No ready knowledge sources found. Wait for processing to complete or upload at least one." },
      { status: 400 },
    );
  }

  try {
    const result = await autoPopulate({
      userId,
      sources,
      userPromptHint: parsed.data.userPromptHint,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Auto-populate failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export const runtime = "nodejs";
export const maxDuration = 60;
