import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/memory/embeddings", () => ({
  embed: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
}));

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = "test-key";
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if ((url as string).includes("openrouter")) {
      const body = JSON.parse((init?.body as string) ?? "{}");
      const prompt = body.messages[0].content as string;
      if (prompt.startsWith("Summarize")) {
        return { ok: true, json: async () => ({ choices: [{ message: { content: "A 3-sentence summary." } }] }) } as any;
      }
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: '[{"fact":"prefers blue","category":"preference","confidence":0.9}]' } }] }),
      } as any;
    }
    throw new Error("unexpected fetch");
  }));
});

import { summarizeSession, extractFacts } from "@/lib/memory/extraction";

describe("extraction", () => {
  it("summarizes a transcript", async () => {
    const s = await summarizeSession("user: hi\nassistant: hello");
    expect(s).toContain("summary");
  });
  it("extracts facts as JSON", async () => {
    const facts = await extractFacts("user: i love blue", []);
    expect(facts).toHaveLength(1);
    expect(facts[0].fact).toBe("prefers blue");
    expect(facts[0].category).toBe("preference");
  });
});
