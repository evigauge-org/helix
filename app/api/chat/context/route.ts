import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { buildChatContext } from "@/lib/chat/context-builder";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const { sessionId, userMessage, memoryPaused } = await req.json();
  if (!sessionId || typeof userMessage !== "string")
    return new Response("Bad request", { status: 400 });
  const ctx = await buildChatContext({
    userId: session.user.id,
    sessionId,
    userMessage,
    memoryPaused: !!memoryPaused,
  });
  return Response.json(ctx);
}
