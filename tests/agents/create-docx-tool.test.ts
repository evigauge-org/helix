import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    agentArtifact: {
      create: vi.fn().mockResolvedValue({ id: "art_1" }),
    },
  },
}));

import createDocx from "@/lib/agents/tools/create_docx";

describe("create_docx tool", () => {
  it("rejects empty markdown", async () => {
    const parsed = createDocx.schema.safeParse({ title: "T", markdown: "" });
    expect(parsed.success).toBe(false);
  });

  it("persists an artifact and returns shape agents expect", async () => {
    const res = await createDocx.execute(
      { userId: "u", runId: "run_1", agentId: "a", tickNumber: 1, log: () => {} },
      { title: "My Memo", markdown: "# Hello\n\nWorld", coverPage: false },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      const d = res.data as {
        artifactId: string; filename: string; mimeType: string;
        bytes: number; tokenCount: number; unmappedTokens: string[];
      };
      expect(d.artifactId).toBe("art_1");
      expect(d.filename.endsWith(".docx")).toBe(true);
      expect(d.mimeType).toContain("wordprocessingml");
      expect(d.bytes).toBeGreaterThan(500);
      expect(d.tokenCount).toBeGreaterThan(0);
      expect(Array.isArray(d.unmappedTokens)).toBe(true);
    }
  });
});
