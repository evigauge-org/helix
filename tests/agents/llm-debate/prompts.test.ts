// tests/agents/llm-debate/prompts.test.ts
import { describe, it, expect } from "vitest";
import {
  buildDebaterSystemPrompt,
  buildJudgeSystemPrompt,
  buildDebaterUserPrompt,
  buildJudgeUserPrompt,
} from "@/lib/agents/llm-debate/prompts";

describe("buildDebaterSystemPrompt", () => {
  it("includes the DD/finance competency block on every round", () => {
    const r1 = buildDebaterSystemPrompt({ round: 1, outputType: "prose", webAccess: true });
    const r2 = buildDebaterSystemPrompt({ round: 2, outputType: "prose", webAccess: true });
    expect(r1).toContain("Investment memos");
    expect(r1).toContain("Unit economics");
    expect(r2).toContain("Unit economics");
  });

  it("round 1 instructs best independent answer without peer context", () => {
    const p = buildDebaterSystemPrompt({ round: 1, outputType: "prose", webAccess: true });
    expect(p).toContain("Round 1");
    expect(p).toMatch(/BEST INDEPENDENT answer/);
    expect(p).not.toContain("peer");
  });

  it("round 2 instructs revision with peer answers", () => {
    const p = buildDebaterSystemPrompt({ round: 2, outputType: "prose", webAccess: true });
    expect(p).toContain("Round 2");
    expect(p).toContain("other three panelists");
  });

  it("prose output asks for markdown", () => {
    const p = buildDebaterSystemPrompt({ round: 1, outputType: "prose", webAccess: true });
    expect(p).toMatch(/markdown/i);
  });

  it("json output embeds the response schema", () => {
    const p = buildDebaterSystemPrompt({
      round: 1, outputType: "json", webAccess: true,
      responseSchema: { recommendation: "string" },
    });
    expect(p).toContain("Return ONLY JSON");
    expect(p).toContain("recommendation");
  });

  it("disabled web access flips the context line", () => {
    const p = buildDebaterSystemPrompt({ round: 1, outputType: "prose", webAccess: false });
    expect(p).toMatch(/DISABLED|disabled|closed-book/i);
  });
});

describe("buildDebaterUserPrompt", () => {
  it("round 1 is just the query", () => {
    const u = buildDebaterUserPrompt({ round: 1, query: "Is TCS a buy?" });
    expect(u).toContain("Is TCS a buy?");
    expect(u).not.toContain("PEER_");
  });

  it("round 2 embeds peer answers", () => {
    const u = buildDebaterUserPrompt({
      round: 2,
      query: "Q",
      peerAnswers: [
        { model: "a", content: "A says yes" },
        { model: "b", content: "B says no" },
        { model: "c", content: "C says maybe" },
      ],
    });
    expect(u).toContain("A says yes");
    expect(u).toContain("B says no");
    expect(u).toContain("C says maybe");
  });
});

describe("buildJudgeSystemPrompt", () => {
  it("includes the DD/finance competency block", () => {
    const p = buildJudgeSystemPrompt({ outputType: "prose", webAccess: true });
    expect(p).toContain("Investment memos");
  });

  it("instructs synthesis not further debate", () => {
    const p = buildJudgeSystemPrompt({ outputType: "prose", webAccess: true });
    expect(p).toMatch(/synthesizer, not a 5th/i);
  });
});

describe("buildJudgeUserPrompt", () => {
  it("embeds the query and all 4 debater answers", () => {
    const u = buildJudgeUserPrompt({
      query: "Original Q",
      debaterAnswers: [
        { model: "a", content: "ans A" },
        { model: "b", content: "ans B" },
        { model: "c", content: "ans C" },
        { model: "d", content: "ans D" },
      ],
    });
    expect(u).toContain("Original Q");
    expect(u).toContain("ans A");
    expect(u).toContain("ans B");
    expect(u).toContain("ans C");
    expect(u).toContain("ans D");
  });
});
