import { NextRequest } from "next/server";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `You are Helix, an AI research intelligence engine. You help users with:

• **Deep Research** — Multi-agent debate where 4 LLMs argue to produce the best, most accurate answer with source verification
• **Document Analysis** — Upload PDFs, DOCX, XLSX, CSV files and ask questions about them
• **Content Creation** — Generate podcasts, slide decks, infographics, quizzes, mind maps from research
• **Business Optimization** — Analyze businesses for cost reduction, revenue growth, and AI/ML opportunities
• **Web Search** — Real-time web search with source quality scoring and fact verification
• **Voice AI** — Full-duplex multilingual voice conversations
• **Personal Intelligence** — Remember user decisions, catch contradictions, monitor topics 24/7

You are knowledgeable, precise, and helpful. When the full Helix backend is available, queries go through a multi-agent pipeline with guardrails. Right now you're responding directly.

Keep responses clear, well-structured with markdown, and cite sources when possible. Be concise for simple questions, detailed for complex research queries.`;

export async function POST(req: NextRequest) {
  if (!OPENROUTER_API_KEY) {
    return new Response(JSON.stringify({ error: "OpenRouter API key not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages, stream } = await req.json();

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "Helix",
    },
    body: JSON.stringify({
      model: "google/gemma-3-27b-it",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages,
      ],
      max_tokens: 4096,
      temperature: 0.7,
      stream: !!stream,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    return new Response(JSON.stringify({ error: `OpenRouter error: ${error}` }), {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Streaming mode — pipe SSE through
  if (stream && res.body) {
    return new Response(res.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Non-streaming fallback
  const data = await res.json();
  const answer = data.choices?.[0]?.message?.content ?? "No response generated.";
  return new Response(JSON.stringify({ answer }), {
    headers: { "Content-Type": "application/json" },
  });
}
