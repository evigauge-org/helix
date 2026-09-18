export type ClassifierCandidate = { id: string; summary: string };

export const CLASSIFIER_PROMPT = (params: {
  candidates: ClassifierCandidate[];
  userMessage: string;
  currentDate: string;
}) => `You are classifying a user message inside a Deep Research chat session.

Here are the MOST RECENT research answers from this session (most recent first):
${params.candidates.length
    ? params.candidates.map((c, i) => `[${i + 1}] id: ${c.id} summary: ${c.summary}`).join("\n")
    : "(none)"}

Today's date: ${params.currentDate}

User's new message: "${params.userMessage}"

Decide EXACTLY one kind:
- "followup_from_context": the message is fully answerable from one of the responses above. Pick its id as response_id.
- "followup_with_web": the message builds on one of the responses above BUT needs fresh web facts to answer properly. Pick the most relevant response_id AND provide a concise web search query (6-10 words) in search_query.
- "new_research": the message is a genuinely new deep-analysis or research request unrelated to the prior responses. Leave response_id and search_query null.

Return ONLY this JSON (no markdown, no prose):
{"kind": "...", "response_id": "..."|null, "search_query": "..."|null}`;

export const RESEARCH_SUMMARY_PROMPT = (params: {
  query: string;
  answer: string;
  artifactKeys: string[];
}) => `Summarize the research response below in 3 sentences. Preserve:
- the exact user question
- the key findings/claims
- the kinds of artifacts produced (e.g., "financial Excel with P&L", "reproducibility card with 4 sources")

Do not invent. Do not exceed 3 sentences.

User question: ${params.query}
Response answer: ${params.answer}
Artifacts present: ${params.artifactKeys.join(", ") || "(none)"}`;

export function buildFollowupSystemPrompt(params: {
  currentDate: string;
  memoryFactsBlock: string;
  sessionSummary: string | null;
  priorQuery: string;
  priorAnswer: string;
  priorSources: { url: string; title?: string | null }[];
  priorArtifactKeys: string[];
  webResults?: { title: string; url: string; snippet: string; published?: string }[];
}): string {
  const sourcesBlock = params.priorSources.length
    ? `  Key sources:\n${params.priorSources.map((s) => `    - ${s.url}${s.title ? " — " + s.title : ""}`).join("\n")}`
    : "";
  const artifactsLine = params.priorArtifactKeys.length
    ? `  Artifacts available to the user on that turn: ${params.priorArtifactKeys.join(", ")}.`
    : "";
  const webBlock = params.webResults && params.webResults.length
    ? `\nFresh web results for this follow-up (sorted newest first):\n${params.webResults
        .map((r, i) => `[${i + 1}] ${r.title} — ${r.url}${r.published ? ` (published: ${r.published})` : ""}\n    ${r.snippet}`)
        .join("\n\n")}`
    : "";
  const summaryLine = params.sessionSummary
    ? `\nCurrent session summary: ${params.sessionSummary}`
    : "";
  return `You are Helix, the user's AI companion. You are answering a follow-up question about a prior research result the user received in this chat. Stay in the user's conversational style (warm, direct, natural — not a formal analyst report). Do not repeat the entire prior answer unless asked; refer to it naturally.

Today's date: ${params.currentDate}
${params.memoryFactsBlock ? "\n" + params.memoryFactsBlock : ""}${summaryLine}

Prior research the user is asking about:
  Question: ${params.priorQuery}
  Answer: ${params.priorAnswer}
${sourcesBlock}
${artifactsLine}
  (Do NOT claim you can send, export, or open these artifacts. The user already has them visible above in the chat.)
${webBlock}

Answer the follow-up. If the prior answer${params.webResults?.length ? " + web results" : ""} don't cover it, say so and suggest turning Deep Research on again for a fresh backend search.`;
}
