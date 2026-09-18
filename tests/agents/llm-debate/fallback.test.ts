// tests/agents/llm-debate/fallback.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/agents/llm-debate/openrouter", () => ({
  callOpenRouter: vi.fn(),
}));

import { runDebate } from "@/lib/agents/llm-debate/engine";
import { callOpenRouter } from "@/lib/agents/llm-debate/openrouter";

const callMock = callOpenRouter as unknown as ReturnType<typeof vi.fn>;

function okAnswer(tag: string) {
  return { ok: true, content: `answer:${tag}`, modelUsed: tag };
}
function fail(status: number) {
  return { ok: false, status, error: `HTTP ${status}` };
}

describe("debate engine degradation cascade", () => {
  it("primary judge fails, retry fails → falls back to emergency judge", async () => {
    callMock.mockReset();
    // 4 round1 ok + 4 round2 ok
    callMock.mockResolvedValueOnce(okAnswer("m1-r1"));
    callMock.mockResolvedValueOnce(okAnswer("m2-r1"));
    callMock.mockResolvedValueOnce(okAnswer("m3-r1"));
    callMock.mockResolvedValueOnce(okAnswer("m4-r1"));
    callMock.mockResolvedValueOnce(okAnswer("m1-r2"));
    callMock.mockResolvedValueOnce(okAnswer("m2-r2"));
    callMock.mockResolvedValueOnce(okAnswer("m3-r2"));
    callMock.mockResolvedValueOnce(okAnswer("m4-r2"));
    // Judge fails twice (initial + retry)
    callMock.mockResolvedValueOnce(fail(503));
    callMock.mockResolvedValueOnce(fail(503));
    // Emergency judge ok
    callMock.mockResolvedValueOnce(okAnswer("emergency-consensus"));

    const out = await runDebate({
      query: "q", outputType: "prose", webAccess: true, maxRoundTokens: 1000,
      models: ["m1", "m2", "m3", "m4"],
      judge: "judge-primary",
      emergencyJudge: "emergency-judge",
    });

    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.consensus).toBe("answer:emergency-consensus");
      expect(out.judgeModelId).toBe("emergency-judge");
      expect(out.degraded).toBe(true);
      expect(out.degradationReason).toMatch(/fallback judge/i);
    }
  });

  it("primary + emergency judge both fail → programmatic context-relevance pick", async () => {
    callMock.mockReset();
    // round1 x4
    callMock.mockResolvedValueOnce(okAnswer("m1-r1"));
    callMock.mockResolvedValueOnce(okAnswer("m2-r1"));
    callMock.mockResolvedValueOnce(okAnswer("m3-r1"));
    callMock.mockResolvedValueOnce(okAnswer("m4-r1"));
    // round2 x4 — m3 is the clearly most relevant answer
    callMock.mockResolvedValueOnce({ ok: true, content: "TCS quarterly revenue steady.", modelUsed: "m1" });
    callMock.mockResolvedValueOnce({ ok: true, content: "I cannot determine.", modelUsed: "m2" });
    callMock.mockResolvedValueOnce({ ok: true, content: "TCS Q4 revenue grew 12% to $6.8B per https://tcs.com/ir", modelUsed: "m3" });
    callMock.mockResolvedValueOnce({ ok: true, content: "Some irrelevant narrative.", modelUsed: "m4" });
    // Judge primary + retry + emergency + emergency-retry all fail (4 calls):
    // status 500 triggers callWithOneRetry's retry path for each judge attempt.
    callMock.mockResolvedValueOnce(fail(500));
    callMock.mockResolvedValueOnce(fail(500));
    callMock.mockResolvedValueOnce(fail(500));
    callMock.mockResolvedValueOnce(fail(500));

    const out = await runDebate({
      query: "TCS Q4 revenue",
      outputType: "prose", webAccess: true, maxRoundTokens: 1000,
      models: ["m1", "m2", "m3", "m4"],
      judge: "jp", emergencyJudge: "je",
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.consensus).toContain("$6.8B");
      expect(out.degraded).toBe(true);
      expect(out.degradationReason).toMatch(/context-relevance/i);
    }
  });

  it("one debater fails round 1 → continues with 3 debaters, marks degraded", async () => {
    callMock.mockReset();
    // Round 1 is parallel: 4 sync first-calls consume mocks[0..3] in m1/m2/m3/m4 order,
    // THEN retries (only m1's) fire in microtask order consuming mocks[4..].
    callMock.mockResolvedValueOnce(fail(503));        // m1 first → triggers retry
    callMock.mockResolvedValueOnce(okAnswer("m2-r1")); // m2 first
    callMock.mockResolvedValueOnce(okAnswer("m3-r1")); // m3 first
    callMock.mockResolvedValueOnce(okAnswer("m4-r1")); // m4 first
    callMock.mockResolvedValueOnce(fail(503));        // m1 retry → dropped
    // 3 round2 ok (m2, m3, m4 surviving)
    callMock.mockResolvedValueOnce(okAnswer("m2-r2"));
    callMock.mockResolvedValueOnce(okAnswer("m3-r2"));
    callMock.mockResolvedValueOnce(okAnswer("m4-r2"));
    // Judge ok
    callMock.mockResolvedValueOnce(okAnswer("consensus"));

    const out = await runDebate({
      query: "q", outputType: "prose", webAccess: true, maxRoundTokens: 1000,
      models: ["m1", "m2", "m3", "m4"], judge: "j", emergencyJudge: "e",
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.perModelAnswers.round1.length).toBe(3);
      expect(out.perModelAnswers.round2.length).toBe(3);
      expect(out.degraded).toBe(true);
      expect(out.degradationReason).toMatch(/debater/i);
    }
  });

  it("all 4 debaters fail round 1 → returns error", async () => {
    callMock.mockReset();
    // 4 initial + 4 retries = 8 failing calls
    for (let i = 0; i < 8; i++) callMock.mockResolvedValueOnce(fail(503));
    const out = await runDebate({
      query: "q", outputType: "prose", webAccess: true, maxRoundTokens: 1000,
      models: ["m1", "m2", "m3", "m4"], judge: "j", emergencyJudge: "e",
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/All debaters unavailable/i);
  });
});
