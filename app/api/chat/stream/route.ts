import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemma-4-26b-a4b-it";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return new Response("OpenRouter not configured", { status: 500 });

  const body = await req.json();
  const { sessionId, systemPrompt, messages } = body as {
    sessionId: string;
    systemPrompt: string;
    messages: { role: "user" | "assistant"; content: string }[];
  };
  if (!sessionId || !Array.isArray(messages) || messages.length === 0)
    return new Response("Bad request", { status: 400 });

  const userTurn = messages.at(-1)!;
  if (userTurn.role !== "user") return new Response("Last message must be user", { status: 400 });

  await prisma.chatMessage.create({
    data: { chatSessionId: sessionId, role: "user", content: userTurn.content },
  });

  const upstream = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      temperature: 0.7,
      max_tokens: 2048,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      plugins: [{ id: "web", engine: "firecrawl", max_results: 5 }],
    }),
  });
  if (!upstream.ok || !upstream.body)
    return new Response(`OpenRouter error ${upstream.status}`, { status: 502 });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let fullAssistant = "";
  const userId = session.user.id;

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              fullAssistant += delta;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
            }
          } catch {}
        }
      }

      if (fullAssistant) {
        // Persist with a synthesized QueryResponse in metadata so reloads
        // render via ConversationResponse (not the error branch).
        const assistantMetadata = {
          query: userTurn.content,
          tier: 0,
          success: true,
          answer: fullAssistant,
          confidence: 1,
          duration_ms: 0,
          conversation_mode: true,
          agents_used: [MODEL],
        };
        await prisma.chatMessage.create({
          data: {
            chatSessionId: sessionId,
            role: "assistant",
            content: fullAssistant,
            metadata: assistantMetadata,
          },
        });
        await inngest.send({
          name: "memory/session.turn-completed",
          data: { sessionId, userId },
        });
      }

      controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
      controller.close();
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
