import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { classifyDeepResearchMessage } from "@/lib/chat/deep-research-classifier";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const { sessionId, userMessage } = body as { sessionId?: string; userMessage?: string };
  if (!sessionId || typeof userMessage !== "string") {
    return new Response("Bad request", { status: 400 });
  }

  const result = await classifyDeepResearchMessage({ userMessage, chatSessionId: sessionId });
  return Response.json(result);
}
