import { prisma } from "@/lib/prisma";
import { embed } from "@/lib/memory/embeddings";
import { getUserFacts, getTopKSessions } from "@/lib/memory/retrieval";
import { buildChatSystemPrompt } from "@/lib/memory/prompts";
import { getExaClient } from "@/lib/exa";

export type ChatContext = {
  systemPrompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
};

const RECENT_WINDOW = 20;

async function fetchWebResults(query: string): Promise<{ title: string; url: string; snippet: string; published?: string }[]> {
  const exa = getExaClient();
  if (!exa) return [];
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  try {
    const res = await exa.searchAndContents(query, {
      numResults: 6,
      useAutoprompt: true,
      type: "auto",
      livecrawl: "always",
      startPublishedDate: ninetyDaysAgo,
      text: { maxCharacters: 800 },
    } as Parameters<typeof exa.searchAndContents>[1]);
    const results = (res.results ?? [])
      .map((r) => {
        const raw = r as { title?: string | null; url: string; text?: string; publishedDate?: string };
        return {
          title: raw.title ?? raw.url,
          url: raw.url,
          snippet: (raw.text ?? "").slice(0, 800),
          published: raw.publishedDate,
        };
      })
      .sort((a, b) => {
        const da = a.published ? Date.parse(a.published) : 0;
        const db = b.published ? Date.parse(b.published) : 0;
        return db - da;
      })
      .slice(0, 5);
    return results;
  } catch {
    return [];
  }
}

export async function buildChatContext(params: {
  userId: string;
  sessionId: string;
  userMessage: string;
  memoryPaused?: boolean;
}): Promise<ChatContext> {
  const { userId, sessionId, userMessage, memoryPaused } = params;

  const queryEmbeddingPromise = memoryPaused
    ? Promise.resolve(null)
    : embed(userMessage).catch(() => null);

  const [session, recentMessages, facts, queryEmbedding, webResults] = await Promise.all([
    prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { summary: true },
    }),
    prisma.chatMessage.findMany({
      where: { chatSessionId: sessionId },
      orderBy: { createdAt: "desc" },
      take: RECENT_WINDOW,
      select: { role: true, content: true },
    }),
    memoryPaused ? Promise.resolve([]) : getUserFacts(userId),
    queryEmbeddingPromise,
    fetchWebResults(userMessage),
  ]);

  const semanticHits = queryEmbedding
    ? await getTopKSessions(userId, queryEmbedding, 3, sessionId).catch(() => [])
    : [];

  const systemPrompt = buildChatSystemPrompt({
    facts,
    currentSummary: session?.summary ?? null,
    semanticHits,
    webResults,
    currentDate: new Date().toISOString().split("T")[0],
  });

  const ordered = recentMessages.reverse().map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  return {
    systemPrompt,
    messages: [...ordered, { role: "user", content: userMessage }],
  };
}
