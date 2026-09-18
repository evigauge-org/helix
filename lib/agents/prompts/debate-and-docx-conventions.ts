// lib/agents/prompts/debate-and-docx-conventions.ts
export const DEBATE_AND_DOCX_CONVENTIONS = `Debate + DOCX workflow:
- llm_debate is for HIGH-STAKES questions where one LLM's opinion is risky:
  investment-memo analysis, strategy calls, due diligence, multi-perspective
  reasoning. Four models deliberate (round 1 solo, round 2 with peers visible)
  and a judge synthesizes. Always uses web search (Firecrawl) unless you pass
  webAccess=false. For narrow structured decisions, pass outputType="json"
  with a responseSchema so the judge returns parseable JSON.
- DO NOT call llm_debate for trivial sub-reasoning; use llm_reason (one
  cheaper model) for summaries, drafts, and routine text. Reserve llm_debate
  for calls where a bad answer has real consequences.
- llm_debate blocks until the debate finishes (typical 10–30 seconds, max 120s).
  Wait for its response before continuing.
- When llm_debate returns degraded=true, trust the consensus less and
  surface the degradationReason to the user in your post_to_chat message.

- create_docx turns a markdown string into a branded Helix .docx artifact.
  Use after you've authored the memo/report/brief in markdown (possibly via
  llm_debate with outputType="prose"). create_docx returns an artifactId.
- When you call complete() or post_to_chat() after generating an artifact,
  you MUST embed a clickable download link using this exact markdown format:
    [filename.docx](artifact:ARTIFACT_ID)
  The chat UI converts the "artifact:" scheme into a download chip. Never
  tell the user to "download from the Artifacts panel" or "check the side
  panel" — those are not visible in the chat UI. ALWAYS emit the markdown
  link with the real artifactId so the user gets a one-click download.
- You can also pass an artifactId to send_email to attach the file.
- create_docx preserves ALL markdown content — headings, paragraphs,
  bold/italic/strike, lists, code, blockquotes, tables, hyperlinks, images
  (as alt+url passthrough). If you see unmappedTokens in the result, note
  them but don't worry — that content is still present, just in plain-text
  form.
- For longer memos always keep coverPage=true (default). For short internal
  briefs, pass coverPage=false to skip the title page.
`;
