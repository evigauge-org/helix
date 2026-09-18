import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    chatMessage: {
      findUnique: vi.fn().mockResolvedValue({
        id: "msg_abc",
        content: "full answer text",
        metadata: {
          query: "What were TCS Q4 results?",
          tier: 3,
          answer: "full answer text",
          sources: [{ url: "https://a", title: "A" }],
          financial_excel: { filename: "x.xlsx" },
          parsed_files: [{ kind: "pdf", name: "y.pdf" }],
        },
      }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    chatSession: {
      findUnique: vi.fn().mockResolvedValue({ summary: null }),
    },
    userMemoryFact: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

import { buildResearchFollowupContext } from "@/lib/chat/research-context-builder";

describe("buildResearchFollowupContext", () => {
  it("builds system prompt with prior research context + artifact keys", async () => {
    const ctx = await buildResearchFollowupContext({
      userId: "u1",
      sessionId: "s1",
      priorMessageId: "msg_abc",
      userMessage: "what was the operating margin?",
    });
    expect(ctx).not.toBeNull();
    expect(ctx!.systemPrompt).toContain("What were TCS Q4 results?");
    expect(ctx!.systemPrompt).toContain("full answer text");
    expect(ctx!.systemPrompt).toContain("https://a");
    expect(ctx!.systemPrompt).toMatch(/financial_excel/);
    expect(ctx!.systemPrompt).toMatch(/parsed_files/);
    expect(ctx!.messages.at(-1)).toEqual({ role: "user", content: "what was the operating margin?" });
  });

  it("injects web results when provided", async () => {
    const ctx = await buildResearchFollowupContext({
      userId: "u1",
      sessionId: "s1",
      priorMessageId: "msg_abc",
      userMessage: "does this apply to Infosys?",
      webResults: [
        { title: "Infosys Q4 FY26", url: "https://inf", snippet: "infy results", published: "2026-04-15" },
      ],
    });
    expect(ctx!.systemPrompt).toContain("Infosys Q4 FY26");
    expect(ctx!.systemPrompt).toContain("https://inf");
  });

  it("returns null when prior message not found", async () => {
    const { prisma } = await import("@/lib/prisma");
    (prisma.chatMessage.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const ctx = await buildResearchFollowupContext({
      userId: "u1",
      sessionId: "s1",
      priorMessageId: "missing",
      userMessage: "hi",
    });
    expect(ctx).toBeNull();
  });
});
