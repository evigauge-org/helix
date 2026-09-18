// app/api/research/adaptive/stream/route.ts
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { inngest } from "@/inngest/client";
import { resolveAgentLlmConfig } from "@/lib/agents/llm/dispatch";
import { runAdaptiveResearch, type AdaptiveEvent } from "@/lib/research/adaptive-agent";
import type { ChatMessage } from "@/lib/agents/llm/types";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const { sessionId, query, history } = body as {
    sessionId?: string;
    query?: string;
    history?: ChatMessage[];
  };
  if (!sessionId || typeof query !== "string" || !query.trim()) {
    return new Response("Bad request", { status: 400 });
  }

  let config;
  try {
    config = await resolveAgentLlmConfig({ runnerProviderId: null, runnerModel: null });
  } catch (e) {
    return new Response(`LLM not configured: ${e instanceof Error ? e.message : ""}`, { status: 500 });
  }

  await prisma.chatMessage.create({ data: { chatSessionId: sessionId, role: "user", content: query } });

  const encoder = new TextEncoder();
  const userId = session.user.id;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: AdaptiveEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        const { answer, sources, followups, steps } = await runAdaptiveResearch({
          query,
          history: Array.isArray(history) ? history.slice(-10) : [],
          config,
          emit: send,
          signal: req.signal,
        });
        await prisma.chatMessage.create({
          data: {
            chatSessionId: sessionId,
            role: "assistant",
            content: answer,
            metadata: {
              query,
              mode: "research",
              tier: 0,
              success: true,
              answer,
              confidence: 1,
              duration_ms: 0,
              conversation_mode: true,
              agents_used: [config.model],
              sources,
              follow_ups: followups,
              // ResearchProgress is an interface (no implicit JSON index
              // signature) — cast to Prisma's JSON input type.
              research_steps: steps as unknown as Prisma.InputJsonValue,
            },
          },
        });
        await inngest.send({ name: "memory/session.turn-completed", data: { sessionId, userId } });
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : "research failed" });
      }
      // The client may have aborted (req.signal), leaving the controller
      // already closed — guard the final flush so it never throws.
      try {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch {}
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
