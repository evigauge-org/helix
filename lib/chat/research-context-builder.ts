import { prisma } from "@/lib/prisma";
import { buildFollowupSystemPrompt } from "@/lib/memory/research-prompts";

const ARTIFACT_KEYS = [
  "parsed_files",
  "attached_files",
  "financial_excel",
  "reproducibility",
  "presentation",
  "carousel",
  "gamma",
] as const;

const RECENT_WINDOW = 6;

export type ResearchFollowupContext = {
  systemPrompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
};

export async function buildResearchFollowupContext(params: {
  userId: string;
  sessionId: string;
  priorMessageId: string;
  userMessage: string;
  webResults?: { title: string; url: string; snippet: string; published?: string }[];
}): Promise<ResearchFollowupContext | null> {
  const { userId, sessionId, priorMessageId, userMessage, webResults } = params;

  const priorMessage = await prisma.chatMessage.findUnique({
    where: { id: priorMessageId },
    select: { content: true, metadata: true },
  });
  if (!priorMessage || !priorMessage.metadata || typeof priorMessage.metadata !== "object") return null;
  const md = priorMessage.metadata as Record<string, unknown>;

  const [session, recent, facts] = await Promise.all([
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
    prisma.userMemoryFact.findMany({
      where: { userId },
      orderBy: [{ confidence: "desc" }, { lastUsedAt: "desc" }],
      take: 50,
    }),
  ]);

  const priorSources = Array.isArray(md.sources)
    ? (md.sources as Array<{ url?: string; title?: string | null }>)
        .filter((s) => typeof s.url === "string")
        .slice(0, 6)
        .map((s) => ({ url: s.url as string, title: s.title ?? null }))
    : [];

  const artifactKeys = ARTIFACT_KEYS.filter((k) => {
    const v = md[k];
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.keys(v).length > 0;
    return true;
  });

  const memoryFactsBlock = facts.length
    ? `What you know about the user:\n${facts.map((f) => `- [${f.category}] ${f.fact}`).join("\n")}`
    : "";

  const systemPrompt = buildFollowupSystemPrompt({
    currentDate: new Date().toISOString().split("T")[0],
    memoryFactsBlock,
    sessionSummary: session?.summary ?? null,
    priorQuery: typeof md.query === "string" ? md.query : "",
    priorAnswer: typeof md.answer === "string" ? md.answer : priorMessage.content,
    priorSources,
    priorArtifactKeys: [...artifactKeys],
    webResults,
  });

  const ordered = recent.reverse().map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  return {
    systemPrompt,
    messages: [...ordered, { role: "user", content: userMessage }],
  };
}
