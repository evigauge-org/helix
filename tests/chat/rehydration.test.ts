import { describe, it, expect } from "vitest";
import { rehydrateMessageResponse } from "@/stores/chat-store";

describe("rehydrateMessageResponse", () => {
  it("keeps tier 3 research response as non-conversational so ResearchResponse renders", () => {
    const r = rehydrateMessageResponse("assistant", "the answer text", {
      query: "What were TCS Q4 results?",
      tier: 3,
      success: true,
      answer: "the answer text",
      confidence: 0.9,
      duration_ms: 4200,
      sources: [{ url: "https://x", title: "Y" }],
      financial_excel: { file_id: "fid1", download_url: "/d/x.xlsx", sheets: 2, tables_extracted: 5, metrics_extracted: 10, scenarios_found: 1 },
    });
    expect(r?.conversation_mode).toBe(false);
    expect(r?.tier).toBe(3);
    expect(r?.financial_excel?.file_id).toBe("fid1");
  });

  it("keeps tier 2 as non-conversational too", () => {
    const r = rehydrateMessageResponse("assistant", "ans", { tier: 2, answer: "ans" });
    expect(r?.conversation_mode).toBe(false);
  });

  it("tier 0 → conversational", () => {
    const r = rehydrateMessageResponse("assistant", "hi", { tier: 0, answer: "hi", conversation_mode: true });
    expect(r?.conversation_mode).toBe(true);
  });

  it("tier 1 with no explicit conversation_mode → conversational by default", () => {
    const r = rehydrateMessageResponse("assistant", "hi", { tier: 1, answer: "hi" });
    expect(r?.conversation_mode).toBe(true);
  });

  it("user message → undefined", () => {
    expect(rehydrateMessageResponse("user", "hi", { tier: 3 })).toBeUndefined();
  });

  it("assistant with no metadata → undefined", () => {
    expect(rehydrateMessageResponse("assistant", "hi", null)).toBeUndefined();
  });
});
