import { describe, it, expect } from "vitest";
import { unwrapToolResult } from "@/lib/agents/tool-result-payload";

// The runner used to wrap an executed tool's ToolResult in `{ result: … }`
// while its own error paths wrote the ToolResult flat. The timeline reads
// `payload.ok` / `payload.error` / `payload.data` at the top level, so every
// executed tool rendered as "Failed — Unknown error" whatever it actually did.
// These are the two payloads that reproduced it, taken verbatim from a run.

describe("unwrapToolResult", () => {
  it("unwraps a wrapped success so the real data is reachable", () => {
    const stored = {
      result: {
        ok: true,
        data: {
          name: "BhavCopy_NSE_CM_0_0_0_20260924_F_0000.csv.zip",
          bytes: 203837,
          mimeType: "application/zip",
          artifactId: "cmugp6bjv000ou2up9lk2ftgx",
        },
      },
    };
    const out = unwrapToolResult(stored);
    expect(out.ok).toBe(true);
    expect((out.data as { artifactId: string }).artifactId).toBe("cmugp6bjv000ou2up9lk2ftgx");
  });

  it("unwraps a wrapped failure so the real error survives", () => {
    const stored = {
      result: {
        ok: false,
        error:
          "NSE report not found for 2026-09-24; the market may have been closed, or the file has not been published yet. Try a different date.",
      },
    };
    const out = unwrapToolResult(stored);
    expect(out.ok).toBe(false);
    expect(out.error).toContain("NSE report not found for 2026-09-24");
  });

  it("leaves an already-flat success untouched", () => {
    const stored = { ok: true, data: { updatedCells: 12 } };
    expect(unwrapToolResult(stored)).toEqual(stored);
  });

  it("leaves an already-flat failure untouched", () => {
    const stored = { ok: false, error: "execution error: boom" };
    expect(unwrapToolResult(stored)).toEqual(stored);
  });

  it("prefers the flat shape when both are somehow present", () => {
    const stored = { ok: false, error: "outer", result: { ok: true, data: 1 } };
    expect(unwrapToolResult(stored).error).toBe("outer");
  });

  it("passes through a payload that carries neither shape", () => {
    const stored = { something: "else" };
    expect(unwrapToolResult(stored)).toEqual(stored);
  });

  it("does not unwrap a tool whose own data happens to be called result", () => {
    // `{ ok: true, result: … }` is flat already — the `ok` key decides.
    const stored = { ok: true, result: { rows: 3 } };
    expect(unwrapToolResult(stored)).toEqual(stored);
  });
});
