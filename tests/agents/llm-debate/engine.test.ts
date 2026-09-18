// tests/agents/llm-debate/engine.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/agents/llm-debate/openrouter", () => {
  let call = 0;
  return {
    callOpenRouter: vi.fn(async (params: { model: string }) => {
      call++;
      return { ok: true, content: `answer-${call}-for-${params.model}`, modelUsed: params.model };
    }),
  };
});

import { runDebate } from "@/lib/agents/llm-debate/engine";
import { callOpenRouter } from "@/lib/agents/llm-debate/openrouter";

const callMock = callOpenRouter as unknown as ReturnType<typeof vi.fn>;

describe("runDebate happy path", () => {
  it("performs exactly 9 calls (4 + 4 + 1) and returns consensus", async () => {
    callMock.mockClear();
    const out = await runDebate({
      query: "Is X a buy?",
      outputType: "prose",
      webAccess: true,
      maxRoundTokens: 1000,
      models: ["m1", "m2", "m3", "m4"],
      judge: "judge-model",
      emergencyJudge: "emergency-judge",
    });
    expect(callMock).toHaveBeenCalledTimes(9);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.consensus).toContain("for-judge-model");
      expect(out.perModelAnswers.round1.length).toBe(4);
      expect(out.perModelAnswers.round2.length).toBe(4);
      expect(out.judgeModelId).toBe("judge-model");
      expect(out.degraded).toBeUndefined();
    }
  });
});
