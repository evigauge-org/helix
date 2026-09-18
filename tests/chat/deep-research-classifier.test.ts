import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/memory/embeddings", () => ({
  embed: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
  toPgVectorLiteral: (v: number[]) => `[${v.join(",")}]`,
}));

vi.mock("@/lib/chat/research-retrieval", () => ({
  getTopKResearch: vi.fn(),
  countResearchInSession: vi.fn(),
}));

import { classifyDeepResearchMessage } from "@/lib/chat/deep-research-classifier";
import { getTopKResearch, countResearchInSession } from "@/lib/chat/research-retrieval";

beforeEach(() => {
  vi.resetAllMocks();
  process.env.OPENROUTER_API_KEY = "test";
});

describe("classifyDeepResearchMessage", () => {
  it("returns new_research when no prior research exists", async () => {
    (countResearchInSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    const r = await classifyDeepResearchMessage({ userMessage: "analyze TCS", chatSessionId: "s1" });
    expect(r).toEqual({ kind: "new_research", messageId: null, searchQuery: null });
  });

  it("parses followup_from_context from OpenRouter", async () => {
    (countResearchInSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (getTopKResearch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { messageId: "msg_abc", summary: "TCS Q4 results", distance: 0.05 },
    ]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"kind":"followup_from_context","response_id":"msg_abc","search_query":null}' } }],
      }),
    }));
    const r = await classifyDeepResearchMessage({ userMessage: "margin?", chatSessionId: "s1" });
    expect(r).toEqual({ kind: "followup_from_context", messageId: "msg_abc", searchQuery: null });
  });

  it("parses followup_with_web", async () => {
    (countResearchInSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (getTopKResearch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { messageId: "msg_abc", summary: "TCS Q4", distance: 0.05 },
    ]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"kind":"followup_with_web","response_id":"msg_abc","search_query":"Infosys Q4 FY26"}' } }],
      }),
    }));
    const r = await classifyDeepResearchMessage({ userMessage: "Infosys too?", chatSessionId: "s1" });
    expect(r.kind).toBe("followup_with_web");
    expect(r.messageId).toBe("msg_abc");
    expect(r.searchQuery).toBe("Infosys Q4 FY26");
  });

  it("falls back on malformed JSON", async () => {
    (countResearchInSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (getTopKResearch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { messageId: "msg_abc", summary: "x", distance: 0.1 },
    ]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "not json" } }] }),
    }));
    const r = await classifyDeepResearchMessage({ userMessage: "hi", chatSessionId: "s1" });
    expect(r.kind).toBe("new_research");
  });

  it("falls back on OpenRouter error", async () => {
    (countResearchInSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (getTopKResearch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { messageId: "msg_abc", summary: "x", distance: 0.1 },
    ]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "err" }));
    const r = await classifyDeepResearchMessage({ userMessage: "hi", chatSessionId: "s1" });
    expect(r.kind).toBe("new_research");
  });
});
