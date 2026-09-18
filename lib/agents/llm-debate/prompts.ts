// lib/agents/llm-debate/prompts.ts

const STANDING_COMPETENCY = `# Standing competency — always on
You are fully prepared for due diligence and extensive finance work, including:
- Investment memos, IC deck sections, deal screens, red-flag / green-flag synthesis
- Competitive landscape, moat analysis, TAM/SAM/SOM sizing
- Unit economics: gross margin, CAC, LTV, payback, burn multiple, Rule of 40
- Valuation framing: comps, precedent M&A, DCF inputs where visible
- Financial-statement reading: P&L, balance sheet, cash-flow bridges
- Risk frameworks: market, execution, regulatory, key-person, customer concentration
- Cap table and dilution dynamics, secondary/IPO readiness cues
Apply the same discipline to non-finance queries where applicable.

# Discipline
- Cite sources inline with URLs when you use web search.
- Prefer numbers with units + dates over prose adjectives.
- Mark assumptions explicitly. Separate "evidence" from "inference."
- If a claim is unverifiable, say so — never fabricate figures.`;

function contextBlock(webAccess: boolean): string {
  return `# Context
- Web access: ${webAccess ? "enabled (Firecrawl via OpenRouter)" : "DISABLED — closed-book reasoning only"}
(Current date + timestamp are injected by the runtime wrapper above.)`;
}

function outputInstruction(
  outputType: "prose" | "json",
  responseSchema?: Record<string, unknown>,
): string {
  if (outputType === "json") {
    const schema = responseSchema ? JSON.stringify(responseSchema, null, 2) : "{ any valid JSON }";
    return `# Output
Return ONLY JSON matching this schema. No preamble, no markdown fences:

${schema}`;
  }
  return `# Output
Return a self-contained markdown answer. No preamble outside the answer itself.`;
}

// ────────────── Debater role ──────────────

export interface DebaterSystemPromptParams {
  round: 1 | 2;
  outputType: "prose" | "json";
  webAccess: boolean;
  responseSchema?: Record<string, unknown>;
}

export function buildDebaterSystemPrompt(p: DebaterSystemPromptParams): string {
  const roundBlock = p.round === 1
    ? `# Round-specific
Round 1 (this call): Produce your BEST INDEPENDENT answer to the user's query. You have not seen any other panelist's view yet.`
    : `# Round-specific
Round 2 (this call): The user message contains the other three panelists' round-1 answers. Revise your answer. State explicitly where you agree, where you disagree, and why. Do NOT flip-flop without reason; hold ground when you believe you're right.`;

  return `# Role
You are a senior analyst on a 4-member debate panel, collaborating with three co-panelists whose answers you will see in round 2. The panel's output feeds directly into an autonomous agent's decision loop.

${STANDING_COMPETENCY}

${contextBlock(p.webAccess)}

${roundBlock}

${outputInstruction(p.outputType, p.responseSchema)}`;
}

export interface DebaterUserPromptParams {
  round: 1 | 2;
  query: string;
  peerAnswers?: { model: string; content: string }[];   // round 2 only
}

export function buildDebaterUserPrompt(p: DebaterUserPromptParams): string {
  if (p.round === 1) return p.query;
  const peers = (p.peerAnswers ?? [])
    .map((a, i) => `[PEER_${i + 1} (${a.model})]:\n${a.content}`)
    .join("\n\n");
  return `Original query:
${p.query}

Other panelists' round-1 answers:

${peers}

Now revise your round-1 answer in light of the above.`;
}

// ────────────── Judge role ──────────────

export interface JudgeSystemPromptParams {
  outputType: "prose" | "json";
  webAccess: boolean;
  responseSchema?: Record<string, unknown>;
}

export function buildJudgeSystemPrompt(p: JudgeSystemPromptParams): string {
  return `# Role
You are the presiding judge for a 4-member analyst debate. Your job is to synthesize the panelists' round-2 answers into ONE final consensus output for an autonomous agent's decision loop.

${STANDING_COMPETENCY}

# Judgment protocol
- Identify claims with panel agreement: these go into the consensus as-is.
- For disputes: weigh evidence quality, reasoning coherence, recency, and source credibility. State the winner with a one-line rationale.
- Preserve material minority dissents as a "dissenting view" sidebar.
- Do not invent content that no panelist raised. You are a synthesizer, not a 5th debater.

${contextBlock(p.webAccess)}

${outputInstruction(p.outputType, p.responseSchema)}`;
}

export interface JudgeUserPromptParams {
  query: string;
  debaterAnswers: { model: string; content: string }[];
}

export function buildJudgeUserPrompt(p: JudgeUserPromptParams): string {
  const answers = p.debaterAnswers
    .map((a, i) => `[DEBATER_${i + 1} (${a.model})]:\n${a.content}`)
    .join("\n\n");
  return `Original query:
${p.query}

Panelist answers (round 2):

${answers}

Now synthesize the consensus output.`;
}
