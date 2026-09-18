import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const draftToken = req.nextUrl.searchParams.get("draftToken");
  if (!draftToken) {
    return NextResponse.json({ error: "draftToken query param required" }, { status: 400 });
  }

  const sources = await prisma.agentKnowledgeSource.findMany({
    where: { userId, draftToken },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ sources });
}
