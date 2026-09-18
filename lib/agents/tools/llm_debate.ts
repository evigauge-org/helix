// lib/agents/tools/llm_debate.ts
import { z } from "zod";
import { registerTool } from "../tool-registry";
import type { ToolDef } from "../types";
import { runDebate } from "@/lib/agents/llm-debate/engine";

const schema = z.object({
  query: z.string().min(10).max(10_000),
  outputType: z.enum(["prose", "json"]).default("prose"),
  responseSchema: z.record(z.string(), z.unknown()).optional(),
  judge: z.string().optional(),
  models: z.array(z.string()).length(4).optional(),
  maxRoundTokens: z.number().int().min(256).max(8000).default(3000),
  webAccess: z.boolean().default(true),
});

function resolveModels(): [string, string, string, string] {
  return [
    process.env.LLM_DEBATE_MODEL_1 ?? "google/gemma-4-26b-a4b-it",
    process.env.LLM_DEBATE_MODEL_2 ?? "x-ai/grok-4",
    process.env.LLM_DEBATE_MODEL_3 ?? "anthropic/claude-opus-4.6",
    process.env.LLM_DEBATE_MODEL_4 ?? "openai/gpt-5.2",
  ];
}

function resolveJudge(): string {
  return process.env.LLM_DEBATE_JUDGE ?? "anthropic/claude-opus-4.6";
}

function resolveEmergencyJudge(): string {
  return process.env.LLM_DEBATE_EMERGENCY_JUDGE ?? "google/gemma-4-26b-a4b-it";
}

const tool: ToolDef<typeof schema> = {
  slug: "llm_debate",
  description:
    "Deliberate with 4 LLMs on hard / high-stakes questions. Two rounds of parallel answers (round 2 sees the others), then a judge synthesizes consensus. Always uses web search (Firecrawl via OpenRouter) unless webAccess=false. Supports prose or structured JSON output. Use for investment-memo-grade questions, due diligence, multi-perspective strategy calls, or anywhere one LLM's opinion feels risky. Blocks until the debate finishes (10-60s typical).",
  schema,
  async execute(_ctx, args) {
    const models = (args.models as [string, string, string, string] | undefined) ?? resolveModels();
    const judge = args.judge ?? resolveJudge();
    const emergencyJudge = resolveEmergencyJudge();

    // Wall-clock cap: 120s via Promise.race
    const debatePromise = runDebate({
      query: args.query,
      outputType: args.outputType,
      responseSchema: args.responseSchema,
      webAccess: args.webAccess,
      maxRoundTokens: args.maxRoundTokens,
      models,
      judge,
      emergencyJudge,
    });

    const timeoutPromise = new Promise<{ ok: false; error: string }>((resolve) => {
      setTimeout(() => resolve({ ok: false, error: "llm_debate timed out after 120s" }), 120_000);
    });

    const raced = await Promise.race([debatePromise, timeoutPromise]);
    if (!raced.ok) return { ok: false, error: raced.error };

    // JSON output path — parse & surface raw output on invalid JSON.
    if (args.outputType === "json") {
      const cleaned = raced.consensus.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      try {
        const parsed = JSON.parse(cleaned);
        return {
          ok: true,
          data: {
            consensus: parsed,
            perModelAnswers: raced.perModelAnswers,
            judgeModelId: raced.judgeModelId,
            degraded: raced.degraded,
            degradationReason: raced.degradationReason,
          },
        };
      } catch {
        return {
          ok: false,
          error: "Judge returned invalid JSON; raw output attached in perModelAnswers for manual recovery",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rawJudgeOutput: raced.consensus as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          perModelAnswers: raced.perModelAnswers as any,
        };
      }
    }

    return {
      ok: true,
      data: {
        consensus: raced.consensus,
        perModelAnswers: raced.perModelAnswers,
        judgeModelId: raced.judgeModelId,
        degraded: raced.degraded,
        degradationReason: raced.degradationReason,
      },
    };
  },
};

registerTool(tool);
export default tool;
