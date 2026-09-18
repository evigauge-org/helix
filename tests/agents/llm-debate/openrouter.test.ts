// tests/agents/llm-debate/openrouter.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { callOpenRouter } from "@/lib/agents/llm-debate/openrouter";

const originalFetch = global.fetch;

describe("callOpenRouter", () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "sk-test";
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns structured error when OPENROUTER_API_KEY is missing", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const out = await callOpenRouter({
      model: "m1", systemPrompt: "s", userPrompt: "u", webAccess: false, maxTokens: 100,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.status).toBe(0);
      expect(out.error).toContain("OPENROUTER_API_KEY not configured");
    }
  });

  it("returns structured error when the model returns empty content", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { content: "" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ) as unknown as typeof global.fetch;
    const out = await callOpenRouter({
      model: "m1", systemPrompt: "s", userPrompt: "u", webAccess: false, maxTokens: 100,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.status).toBe(200);
      expect(out.error).toContain("empty content");
    }
  });

  it("injects current ISO date into system message at call time", async () => {
    const body = await captureBody(async () => {
      await callOpenRouter({
        model: "m1",
        systemPrompt: "role",
        userPrompt: "q",
        webAccess: true,
        maxTokens: 100,
      });
    });
    const sys = body.messages[0];
    expect(sys.role).toBe("system");
    expect(sys.content).toMatch(/Current date \(UTC\): \d{4}-\d{2}-\d{2}/);
    expect(sys.content).toMatch(/Current timestamp \(UTC\): \d{4}-\d{2}-\d{2}T/);
  });

  it("includes web plugin with firecrawl engine when webAccess true", async () => {
    const body = await captureBody(async () => {
      await callOpenRouter({
        model: "m1", systemPrompt: "s", userPrompt: "u", webAccess: true, maxTokens: 100,
      });
    });
    expect(body.plugins).toEqual([{ id: "web", engine: "firecrawl" }]);
  });

  it("omits plugins field when webAccess false", async () => {
    const body = await captureBody(async () => {
      await callOpenRouter({
        model: "m1", systemPrompt: "s", userPrompt: "u", webAccess: false, maxTokens: 100,
      });
    });
    expect(body.plugins).toBeUndefined();
  });

  it("returns the model content on 2xx", async () => {
    mockFetchOk({ choices: [{ message: { content: "hello world" } }] });
    const out = await callOpenRouter({ model: "m1", systemPrompt: "s", userPrompt: "u", webAccess: false, maxTokens: 100 });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.content).toBe("hello world");
  });

  it("returns structured error on non-2xx with status", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response("boom", { status: 503 }));
    const out = await callOpenRouter({ model: "m1", systemPrompt: "s", userPrompt: "u", webAccess: false, maxTokens: 100 });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.status).toBe(503);
      expect(out.error).toContain("503");
    }
  });

  it("returns timeout error when signal aborts", async () => {
    global.fetch = vi.fn().mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), 10)),
    );
    const out = await callOpenRouter({
      model: "m1", systemPrompt: "s", userPrompt: "u", webAccess: false, maxTokens: 100, timeoutMs: 5,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.status).toBe(0);
      expect(out.error.toLowerCase()).toContain("timeout");
    }
  });
});

// Helpers

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockFetchOk(json: any) {
  global.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(json), { status: 200, headers: { "Content-Type": "application/json" } }),
  ) as unknown as typeof global.fetch;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function captureBody(fn: () => Promise<void>): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let captured: any = null;
  global.fetch = vi.fn(async (_url: unknown, init: unknown) => {
    captured = JSON.parse((init as { body: string }).body);
    return new Response(JSON.stringify({ choices: [{ message: { content: "x" } }] }), { status: 200 });
  }) as unknown as typeof global.fetch;
  await fn();
  return captured;
}
