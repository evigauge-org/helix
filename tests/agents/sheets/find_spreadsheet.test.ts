// tests/agents/sheets/find_spreadsheet.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/composio", () => ({
  composio: {
    connectedAccounts: { list: vi.fn() },
    tools: { proxyExecute: vi.fn() },
  },
  SHEETS_AUTH_CONFIG_ID: "ac_sheets_test",
}));

import { composio } from "@/lib/composio";
import findSpreadsheet from "@/lib/agents/tools/sheets/find_spreadsheet";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const listMock = (composio as any).connectedAccounts.list as ReturnType<typeof vi.fn>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const proxyMock = (composio as any).tools.proxyExecute as ReturnType<typeof vi.fn>;

describe("find_spreadsheet", () => {
  beforeEach(() => {
    listMock.mockReset();
    proxyMock.mockReset();
  });

  it("rejects empty nameQuery via zod", () => {
    const parsed = findSpreadsheet.schema.safeParse({ nameQuery: "" });
    expect(parsed.success).toBe(false);
  });

  it("returns 'not connected' error when user has no active sheets connection", async () => {
    listMock.mockResolvedValueOnce({ items: [] });
    const res = await findSpreadsheet.execute(
      { userId: "u_1", runId: "r", agentId: "a", tickNumber: 1, log: () => {} },
      { nameQuery: "Companies" },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not connected/i);
  });

  it("returns normalized matches on happy path", async () => {
    listMock.mockResolvedValueOnce({ items: [{ id: "ca_1" }] });
    proxyMock.mockResolvedValueOnce({
      status: 200,
      data: {
        files: [
          { id: "sheet_abc", name: "Companies Pipeline", modifiedTime: "2026-04-01T10:00:00Z" },
          { id: "sheet_xyz", name: "Companies Q1", modifiedTime: "2026-03-15T08:00:00Z" },
        ],
      },
    });
    const res = await findSpreadsheet.execute(
      { userId: "u_1", runId: "r", agentId: "a", tickNumber: 1, log: () => {} },
      { nameQuery: "Companies" },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      const d = res.data as { matches: { id: string; name: string; modifiedTime: string; url: string }[] };
      expect(d.matches).toHaveLength(2);
      expect(d.matches[0]).toEqual({
        id: "sheet_abc",
        name: "Companies Pipeline",
        modifiedTime: "2026-04-01T10:00:00Z",
        url: "https://docs.google.com/spreadsheets/d/sheet_abc/edit",
      });
    }
  });

  it("escapes single quotes in the Drive q parameter (prevents injection)", async () => {
    listMock.mockResolvedValueOnce({ items: [{ id: "ca_1" }] });
    proxyMock.mockResolvedValueOnce({ status: 200, data: { files: [] } });
    await findSpreadsheet.execute(
      { userId: "u_1", runId: "r", agentId: "a", tickNumber: 1, log: () => {} },
      { nameQuery: "O'Brien's list" },
    );
    const call = proxyMock.mock.calls[0][0];
    // URLSearchParams encodes single quotes as %27 and backslashes as %5C.
    // The q parameter must escape the apostrophe as \' per Drive API v3 spec,
    // which after URL encoding becomes %5C%27.
    expect(call.endpoint).toContain("name+contains+%27O%5C%27Brien%5C%27s+list%27");
  });

  it("returns structured error on non-2xx from Drive", async () => {
    listMock.mockResolvedValueOnce({ items: [{ id: "ca_1" }] });
    proxyMock.mockResolvedValueOnce({ status: 403, data: { error: { message: "insufficient scope" } } });
    const res = await findSpreadsheet.execute(
      { userId: "u_1", runId: "r", agentId: "a", tickNumber: 1, log: () => {} },
      { nameQuery: "anything" },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/403/);
  });

  it("caps results at 10 even if Drive returns more", async () => {
    const many = Array.from({ length: 25 }, (_, i) => ({
      id: `s_${i}`, name: `Sheet ${i}`, modifiedTime: "2026-01-01T00:00:00Z",
    }));
    listMock.mockResolvedValueOnce({ items: [{ id: "ca_1" }] });
    proxyMock.mockResolvedValueOnce({ status: 200, data: { files: many } });
    const res = await findSpreadsheet.execute(
      { userId: "u_1", runId: "r", agentId: "a", tickNumber: 1, log: () => {} },
      { nameQuery: "Sheet" },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      const d = res.data as { matches: unknown[] };
      expect(d.matches.length).toBeLessThanOrEqual(10);
    }
  });
});
