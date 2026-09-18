import { describe, it, expect } from "vitest";
import { buildBatchUpdate } from "@/lib/agents/tools/sheets/build-batch-update";
import type { EnterpriseReport } from "@/lib/agents/tools/sheets/types";

describe("buildBatchUpdate", () => {
  const sample: EnterpriseReport = {
    title: "TCS FY26",
    sheets: [
      {
        name: "Summary",
        columns: [
          { header: "Metric", type: "text" },
          { header: "Value ($mm)", type: "currency" },
          { header: "Growth %", type: "percent" },
        ],
        rows: [
          { cells: [{ value: "Revenue" }, { value: 64988, role: "input", source: "Source: TCS Q4 FY26 press release" }, { value: 0.121, role: "formula" }] },
          { cells: [{ value: "Net Profit" }, { value: 13718, role: "input" }, { value: "=B2/B3", role: "formula" }] },
          { cells: [{ value: "Assumption Check", background: "assumption" }, { value: 0.1, role: "input", background: "assumption" }, { value: 0 }] },
        ],
      },
    ],
  };

  it("returns a non-empty array of requests", () => {
    const { requests } = buildBatchUpdate(sample, [{ sheetId: 0, name: "Sheet1" }]);
    expect(Array.isArray(requests)).toBe(true);
    expect(requests.length).toBeGreaterThan(0);
  });

  it("includes a freeze request when frozen_header !== false", () => {
    const { requests } = buildBatchUpdate(sample, [{ sheetId: 0, name: "Sheet1" }]);
    expect(requests.some((r) => "updateSheetProperties" in r && JSON.stringify(r).includes("frozenRowCount"))).toBe(true);
  });

  it("sets navy header background on row 0", () => {
    const { requests } = buildBatchUpdate(sample, [{ sheetId: 0, name: "Sheet1" }]);
    const headerFormatReq = requests.find((r) => {
      const s = JSON.stringify(r);
      return s.includes("0.0588") && s.includes("backgroundColor");
    });
    expect(headerFormatReq).toBeTruthy();
  });

  it("marks cells with value starting with = as formulaValue", () => {
    const { requests } = buildBatchUpdate(sample, [{ sheetId: 0, name: "Sheet1" }]);
    const all = JSON.stringify(requests);
    expect(all).toContain('"formulaValue":"=B2/B3"');
  });

  it("applies yellow background when background=assumption", () => {
    const { requests } = buildBatchUpdate(sample, [{ sheetId: 0, name: "Sheet1" }]);
    const all = JSON.stringify(requests);
    expect(all).toMatch(/"red":1,"green":1,"blue":0/);
  });

  it("attaches a note when cell.source is set", () => {
    const { requests } = buildBatchUpdate(sample, [{ sheetId: 0, name: "Sheet1" }]);
    const all = JSON.stringify(requests);
    expect(all).toContain("TCS Q4 FY26 press release");
  });

  it("applies currency number format to the second column", () => {
    const { requests } = buildBatchUpdate(sample, [{ sheetId: 0, name: "Sheet1" }]);
    const all = JSON.stringify(requests);
    expect(all).toContain('$#,##0;($#,##0);\\"-\\"');
  });
});
