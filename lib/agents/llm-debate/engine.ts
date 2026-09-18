// lib/agents/llm-debate/engine.ts
import { callOpenRouter, type OpenRouterResult } from "./openrouter";
import {
  buildDebaterSystemPrompt,
  buildDebaterUserPrompt,
  buildJudgeSystemPrompt,
  buildJudgeUserPrompt,
} from "./prompts";
import { pickMostRelevant } from "./score";

export interface DebateParams {
  query: string;
  outputType: "prose" | "json";
  responseSchema?: Record<string, unknown>;
  webAccess: boolean;
  maxRoundTokens: number;
  models: [string, string, string, string];
  judge: string;
  emergencyJudge: string;
}

export interface Answer {
  model: string;
  content: string;
}

export type DebateResult =
  | {
      ok: true;
      consensus: string;
      perModelAnswers: { round1: Answer[]; round2: Answer[] };
      judgeModelId: string;
      degraded?: boolean;
      degradationReason?: string;
    }
  | {
      ok: false;
      error: string;
      partial?: { round1?: Answer[]; round2?: Answer[]; judgeAttempted?: boolean };
    };

async function callWithOneRetry(
  params: Parameters<typeof callOpenRouter>[0],
): Promise<OpenRouterResult> {
  const first = await callOpenRouter(params);
  if (first.ok) return first;
  // Retry transient / retry-safe errors:
  //   >=500 — server error
  //   ===0  — client-side abort / network / timeout
  //   ===429 — rate limit (idempotent-safe to retry once)
  //   ===408 — request timeout (same)
  const transient = first.status >= 500 || first.status === 0 || first.status === 429 || first.status === 408;
  if (transient) {
    const retry = await callOpenRouter(params);
    return retry;
  }
  return first;
}

export async function runDebate(p: DebateParams): Promise<DebateResult> {
  // ── Round 1 (parallel, 4) ──
  const r1System = buildDebaterSystemPrompt({
    round: 1,
    outputType: p.outputType,
    webAccess: p.webAccess,
    responseSchema: p.responseSchema,
  });
  const r1User = buildDebaterUserPrompt({ round: 1, query: p.query });

  const r1Results = await Promise.all(
    p.models.map((model) =>
      callWithOneRetry({
        model,
        systemPrompt: r1System,
        userPrompt: r1User,
        webAccess: p.webAccess,
        maxTokens: p.maxRoundTokens,
      }).then((res) => ({ model, res })),
    ),
  );

  const round1: Answer[] = r1Results
    .filter((r) => r.res.ok)
    .map((r) => ({ model: r.model, content: (r.res as { ok: true; content: string }).content }));

  if (round1.length === 0) {
    return { ok: false, error: "All debaters unavailable in round 1" };
  }

  const droppedAfterR1 = r1Results.length - round1.length;
  const survivingModels = round1.map((a) => a.model);

  // ── Round 2 (parallel, across surviving models) ──
  const r2System = buildDebaterSystemPrompt({
    round: 2,
    outputType: p.outputType,
    webAccess: p.webAccess,
    responseSchema: p.responseSchema,
  });

  const r2Results = await Promise.all(
    survivingModels.map((model) => {
      const peerAnswers = round1.filter((a) => a.model !== model);
      const userPrompt = buildDebaterUserPrompt({ round: 2, query: p.query, peerAnswers });
      return callWithOneRetry({
        model,
        systemPrompt: r2System,
        userPrompt,
        webAccess: p.webAccess,
        maxTokens: p.maxRoundTokens,
      }).then((res) => ({ model, res }));
    }),
  );

  const round2: Answer[] = r2Results
    .filter((r) => r.res.ok)
    .map((r) => ({ model: r.model, content: (r.res as { ok: true; content: string }).content }));

  if (round2.length === 0) {
    return {
      ok: false,
      error: "All debaters unavailable in round 2",
      partial: { round1, judgeAttempted: false },
    };
  }

  // ── Judge cascade ──
  const judgeSystem = buildJudgeSystemPrompt({
    outputType: p.outputType,
    webAccess: p.webAccess,
    responseSchema: p.responseSchema,
  });
  const judgeUser = buildJudgeUserPrompt({ query: p.query, debaterAnswers: round2 });

  // Tier 1 — primary judge with one retry
  const tier1 = await callWithOneRetry({
    model: p.judge,
    systemPrompt: judgeSystem,
    userPrompt: judgeUser,
    webAccess: p.webAccess,
    maxTokens: p.maxRoundTokens,
  });

  const degraded = droppedAfterR1 > 0 ? true : undefined;
  const degReason =
    droppedAfterR1 > 0 ? `${droppedAfterR1} debater(s) dropped due to failures` : undefined;

  if (tier1.ok) {
    return {
      ok: true,
      consensus: tier1.content,
      perModelAnswers: { round1, round2 },
      judgeModelId: p.judge,
      degraded,
      degradationReason: degReason,
    };
  }

  // Tier 2 — emergency judge
  const tier2 = await callWithOneRetry({
    model: p.emergencyJudge,
    systemPrompt: judgeSystem,
    userPrompt: judgeUser,
    webAccess: p.webAccess,
    maxTokens: p.maxRoundTokens,
  });

  if (tier2.ok) {
    return {
      ok: true,
      consensus: tier2.content,
      perModelAnswers: { round1, round2 },
      judgeModelId: p.emergencyJudge,
      degraded: true,
      degradationReason: "primary judge failed; used fallback judge",
    };
  }

  // Tier 3 — programmatic context-relevance pick
  const best = pickMostRelevant(p.query, round2);
  return {
    ok: true,
    consensus: best.content,
    perModelAnswers: { round1, round2 },
    judgeModelId: p.emergencyJudge,
    degraded: true,
    degradationReason:
      "primary + fallback judges both failed; selected by context-relevance scoring",
  };
}
