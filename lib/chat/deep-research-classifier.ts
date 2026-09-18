import { embed } from "@/lib/memory/embeddings";
import { getTopKResearch, countResearchInSession } from "@/lib/chat/research-retrieval";
import { CLASSIFIER_PROMPT } from "@/lib/memory/research-prompts";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemma-4-26b-a4b-it";

export type ClassificationKind = "followup_from_context" | "followup_with_web" | "new_research";
export type Classification = {
  kind: ClassificationKind;
  messageId: string | null;
  searchQuery: string | null;
};

const NEW_RESEARCH: Classification = { kind: "new_research", messageId: null, searchQuery: null };

export async function classifyDeepResearchMessage(params: {
  userMessage: string;
  chatSessionId: string;
}): Promise<Classification> {
  const { userMessage, chatSessionId } = params;

  const count = await countResearchInSession(chatSessionId);
  if (count === 0) return NEW_RESEARCH;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return NEW_RESEARCH;

  let queryEmbedding: number[];
  try {
    queryEmbedding = await embed(userMessage);
  } catch {
    return NEW_RESEARCH;
  }

  const candidates = await getTopKResearch(chatSessionId, queryEmbedding, 3).catch(() => []);
  if (candidates.length === 0) return NEW_RESEARCH;

  const prompt = CLASSIFIER_PROMPT({
    candidates: candidates.map((c) => ({ id: c.messageId, summary: c.summary })),
    userMessage,
    currentDate: new Date().toISOString().split("T")[0],
  });

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 0.1,
      }),
    });
    if (!res.ok) return NEW_RESEARCH;
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const kind = parsed?.kind;
    if (kind !== "followup_from_context" && kind !== "followup_with_web" && kind !== "new_research") {
      return NEW_RESEARCH;
    }
    if (kind === "new_research") return NEW_RESEARCH;

    const messageId = typeof parsed.response_id === "string" ? parsed.response_id : null;
    if (!messageId || !candidates.some((c) => c.messageId === messageId)) return NEW_RESEARCH;

    const searchQuery =
      kind === "followup_with_web" && typeof parsed.search_query === "string" && parsed.search_query.length > 0
        ? parsed.search_query
        : null;
    if (kind === "followup_with_web" && !searchQuery) return NEW_RESEARCH;

    return { kind, messageId, searchQuery };
  } catch {
    return NEW_RESEARCH;
  }
}
