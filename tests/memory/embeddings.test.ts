import { describe, it, expect, vi, beforeEach } from "vitest";
import { embed } from "@/lib/memory/embeddings";

describe("embed", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns a 1536-dim vector from OpenAI", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: new Array(1536).fill(0.1) }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const v = await embed("hello world");
    expect(v).toHaveLength(1536);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/embeddings",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws on non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "boom" }));
    await expect(embed("x")).rejects.toThrow(/OpenAI embedding failed/);
  }, 15_000);

  it("throws when OPENAI_API_KEY is missing", async () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      await expect(embed("x")).rejects.toThrow(/OPENAI_API_KEY is not configured/);
    } finally {
      if (original !== undefined) process.env.OPENAI_API_KEY = original;
    }
  });

  it("throws on malformed response shape", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.1, 0.2] }] }),
    }));
    await expect(embed("x")).rejects.toThrow(/unexpected shape/);
  }, 15_000);
});
