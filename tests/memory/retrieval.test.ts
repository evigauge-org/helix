import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userMemoryFact: {
      findMany: vi.fn().mockResolvedValue([
        { id: "f1", fact: "builds Helix", category: "project", confidence: 0.9, lastUsedAt: new Date(), userId: "u1", createdAt: new Date(), updatedAt: new Date() },
      ]),
    },
    $queryRaw: vi.fn().mockResolvedValue([
      { sessionId: "sess1", summary: "talked about carousels", distance: 0.12 },
    ]),
  },
}));

import { getUserFacts, getTopKSessions } from "@/lib/memory/retrieval";

describe("retrieval", () => {
  it("loads user facts", async () => {
    const facts = await getUserFacts("u1");
    expect(facts).toHaveLength(1);
    expect(facts[0].fact).toContain("Helix");
    expect(facts[0].category).toBe("project");
  });

  it("runs cosine search via $queryRaw", async () => {
    const hits = await getTopKSessions("u1", new Array(1536).fill(0), 3);
    expect(hits).toHaveLength(1);
    expect(hits[0].summary).toContain("carousels");
    expect(hits[0].sessionId).toBe("sess1");
  });
});
