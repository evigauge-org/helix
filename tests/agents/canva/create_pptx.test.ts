import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentArtifact: {
      create: vi.fn().mockResolvedValue({ id: "art_1" }),
    },
  },
}));

import createPptx from "@/lib/agents/tools/canva/create_pptx";

const ctx = {
  userId: "u_1",
  agentId: "a_1",
  runId: "run_1",
  tickNumber: 1,
  log: () => {},
};

describe("create_pptx", () => {
  it("rejects an invalid deck shape", async () => {
    const parsed = createPptx.schema.safeParse({ deck: { title: "x" } });
    expect(parsed.success).toBe(false);
  });

  it("persists an artifact and returns the shape agents expect", async () => {
    const deck = {
      title: "Test",
      subtitle: "sub",
      promise: "you'll test",
      slides: [
        { layout: "title" as const, title: "Test", subtitle: "sub" },
        { layout: "content" as const, title: "Point", bullets: ["a", "b"] },
        { layout: "close" as const, title: "End", subtitle: "bye" },
      ],
    };
    const res = await createPptx.execute(ctx, { deck, title: "Test" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const data = res.data as { artifactId: string; filename: string; slideCount: number; title: string };
      expect(data.artifactId).toBe("art_1");
      expect(data.slideCount).toBe(3);
      expect(data.filename.endsWith(".pptx")).toBe(true);
    }
  });
});
