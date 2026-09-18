import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { buildResearchFollowupContext } from "@/lib/chat/research-context-builder";
import { getExaClient } from "@/lib/exa";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemma-4-26b-a4b-it";

async function fetchWebResults(query: string) {
  const exa = getExaClient();
  if (!exa) return [];
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  try {
    const res = await exa.searchAndContents(query, {
      numResults: 5,
      useAutoprompt: true,
      livecrawl: "always",
      startPublishedDate: ninetyDaysAgo,
      text: { maxCharacters: 800 },
    } as Parameters<typeof exa.searchAndContents>[1]);
    return (res.results ?? [])
      .map((r) => {
        const raw = r as { title?: string | null; url: string; text?: string; publishedDate?: string };
        return {
          title: raw.title ?? raw.url,
          url: raw.url,
          snippet: (raw.text ?? "").slice(0, 800),
          published: raw.publishedDate,
        };
      })
      .sort((a, b) => Date.parse(b.published ?? "0") - Date.parse(a.published ?? "0"))
      .slice(0, 5);
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return new Response("OpenRouter not configured", { status: 500 });

  const body = await req.json();
  const { sessionId, priorMessageId, userMessage, searchQuery } = body as {
    sessionId?: string;
    priorMessageId?: string;
    userMessage?: string;
    searchQuery?: string | null;
  };
  if (!sessionId || !priorMessageId || typeof userMessage !== "string") {
    return new Response("Bad request", { status: 400 });
  }

  const webResults = searchQuery ? await fetchWebResults(searchQuery) : undefined;

  const ctx = await buildResearchFollowupContext({
    userId: session.user.id,
    sessionId,
    priorMessageId,
    userMessage,
    webResults,
  });
  if (!ctx) return new Response("Prior message not found", { status: 404 });

  await prisma.chatMessage.create({
    data: { chatSessionId: sessionId, role: "user", content: userMessage },
  });

  const upstream = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      temperature: 0.6,
      max_tokens: 1200,
      messages: [{ role: "system", content: ctx.systemPrompt }, ...ctx.messages],
      plugins: [{ id: "web", engine: "firecrawl", max_results: 5 }],
    }),
  });
  if (!upstream.ok || !upstream.body) {
    return new Response(`OpenRouter error ${upstream.status}`, { status: 502 });
  }

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
        const assistantMetadata = {
          query: userMessage,
          tier: 0,
          success: true,
          answer: fullAssistant,
          confidence: 1,
          duration_ms: 0,
          conversation_mode: true,
          agents_used: [MODEL],
          followup_of: priorMessageId,
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

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
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
