import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/memory/embeddings", () => ({
  embed: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
  toPgVectorLiteral: (v: number[]) => `[${v.join(",")}]`,
}));
vi.mock("@/lib/memory/retrieval", () => ({
  getUserFacts: vi.fn().mockResolvedValue([
    { id: "f1", fact: "builds Helix", category: "project", confidence: 0.9 },
  ]),
  getTopKSessions: vi.fn().mockResolvedValue([
    { sessionId: "s1", summary: "discussed carousel design", distance: 0.1 },
  ]),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    chatSession: {
      findUnique: vi.fn().mockResolvedValue({ summary: "user asked about auth setup" }),
    },
    chatMessage: {
      findMany: vi.fn().mockResolvedValue([
        { role: "assistant", content: "hello" },
        { role: "user", content: "hi" },
      ]),
    },
  },
}));

import { buildChatContext } from "@/lib/chat/context-builder";

describe("buildChatContext", () => {
  it("assembles system prompt + messages", async () => {
    const ctx = await buildChatContext({
      userId: "u1",
      sessionId: "s1",
      userMessage: "how are iran-us talks going?",
    });
    expect(ctx.systemPrompt).toContain("builds Helix");
    expect(ctx.systemPrompt).toContain("discussed carousel design");
    expect(ctx.systemPrompt).toContain("user asked about auth setup");
    expect(ctx.messages.at(-1)).toEqual({ role: "user", content: "how are iran-us talks going?" });
  });
});
