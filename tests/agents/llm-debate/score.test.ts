// tests/agents/llm-debate/score.test.ts
import { describe, it, expect } from "vitest";
import { scoreAnswer, pickMostRelevant } from "@/lib/agents/llm-debate/score";

describe("scoreAnswer", () => {
  it("scores +2 per distinct stopword-filtered keyword from query present in answer", () => {
    const s = scoreAnswer({
      query: "What is TCS quarterly revenue growth?",
      answer: "TCS revenue grew 12% in Q4.",
    });
    // stopword-filtered keywords: tcs, quarterly, revenue, growth
    // answer hits: tcs + revenue ⇒ 2 * 2 = 4
    // plus 12% is a numeric hit ⇒ +1 ⇒ total ≥ 5
    expect(s).toBeGreaterThanOrEqual(4);
  });

  it("scores +1 per number-with-unit / currency token", () => {
    const s = scoreAnswer({
      query: "growth",
      answer: "Revenue was $4.2B, margins 22%, CAGR 12% for 2026-03-31.",
    });
    // growth is non-stopword keyword present? no — answer doesn't contain "growth" literally
    // 4 number-like tokens: $4.2B, 22%, 12%, 2026-03-31 ⇒ +4
    expect(s).toBeGreaterThanOrEqual(4);
  });

  it("scores +1 per http(s) URL as a citation", () => {
    const s = scoreAnswer({
      query: "source",
      answer: "See https://example.com/report and http://foo.com/x",
    });
    // 2 URLs ⇒ +2 minimum
    expect(s).toBeGreaterThanOrEqual(2);
  });

  it("penalizes -2 for evasion phrases", () => {
    const real = scoreAnswer({
      query: "TCS revenue",
      answer: "TCS revenue was $6.8B last year.",
    });
    const evasive = scoreAnswer({
      query: "TCS revenue",
      answer: "I cannot determine TCS revenue without more context.",
    });
    // real gets 4 (tcs+revenue) + 1 ($6.8B) = 5
    // evasive gets 4 (tcs+revenue) - 2 (I cannot determine) - 2 (without more context) = 0
    expect(evasive).toBeLessThan(real);
  });
});

describe("pickMostRelevant", () => {
  it("picks the answer with the highest score given the query", () => {
    const query = "TCS Q4 revenue growth";
    const answers = [
      { model: "a", content: "I don't have access to that information." },
      { model: "b", content: "TCS Q4 revenue grew 12% YoY to $6.8B per https://tcs.com/ir" },
      { model: "c", content: "Revenue, revenue, revenue." },
    ];
    const best = pickMostRelevant(query, answers);
    expect(best.model).toBe("b");
  });

  it("returns a valid tie-break choice when two answers score equal", () => {
    const answers = [
      { model: "x", content: "abc" },
      { model: "y", content: "abc" },
    ];
    const best = pickMostRelevant("abc", answers);
    expect(["x", "y"]).toContain(best.model);
  });

  it("throws when given empty answers list", () => {
    expect(() => pickMostRelevant("q", [])).toThrow();
  });
});
