import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { inngest } from "@/inngest/client";

// GET — load messages for a session
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await params;

  const messages = await prisma.chatMessage.findMany({
    where: { chatSessionId: sessionId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      content: true,
      metadata: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ messages });
}

// POST — save a message to a session
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await params;
  const { role, content, metadata } = await req.json();

  const message = await prisma.chatMessage.create({
    data: {
      chatSessionId: sessionId,
      role,
      content,
      metadata: metadata ?? undefined,
    },
  });

  // Update session title from first user message
  const count = await prisma.chatMessage.count({ where: { chatSessionId: sessionId } });
  if (count === 1 && role === "user") {
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { title: content.slice(0, 80) },
    });
  }

  // Fire embedding pipeline for completed deep-research (tier >= 2) assistant messages.
  if (role === "assistant" && message?.id) {
    const md = (metadata ?? null) as Record<string, unknown> | null;
    const tier = md && typeof md.tier === "number" ? (md.tier as number) : 0;
    if (tier >= 2) {
      try {
        await inngest.send({
          name: "memory/research.completed",
          data: {
            messageId: message.id,
            chatSessionId: sessionId,
            userId: session.user.id,
          },
        });
      } catch (err) {
        console.error("[messages.POST] inngest.send failed", err);
      }
    }
  }

  return NextResponse.json({ message });
}
