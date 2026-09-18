import { describe, it, expect } from "vitest";
import { enterpriseReportSchema } from "@/lib/agents/tools/sheets/types";

describe("enterpriseReportSchema — coerces LLM-friendly shapes", () => {
  const columns = [
    { header: "Metric", type: "text" as const },
    { header: "Value", type: "currency" as const },
  ];

  it("accepts the canonical shape: rows: [{ cells: [{value}, {value}] }]", () => {
    const parsed = enterpriseReportSchema.parse({
      title: "X",
      sheets: [
        {
          name: "A",
          columns,
          rows: [{ cells: [{ value: "Revenue" }, { value: 100 }] }],
        },
      ],
    });
    expect(parsed.sheets[0].rows[0].cells).toEqual([
      { value: "Revenue" },
      { value: 100 },
    ]);
  });

  it("accepts rows as array-of-arrays (cells inlined)", () => {
    const parsed = enterpriseReportSchema.parse({
      title: "X",
      sheets: [
        {
          name: "A",
          columns,
          rows: [[{ value: "Revenue" }, { value: 100 }]],
        },
      ],
    });
    expect(parsed.sheets[0].rows[0].cells[0]).toEqual({ value: "Revenue" });
    expect(parsed.sheets[0].rows[0].cells[1]).toEqual({ value: 100 });
  });

  it("accepts cells as raw primitive values", () => {
    const parsed = enterpriseReportSchema.parse({
      title: "X",
      sheets: [
        {
          name: "A",
          columns,
          rows: [["Revenue", 100]],
        },
      ],
    });
    expect(parsed.sheets[0].rows[0].cells[0]).toEqual({ value: "Revenue" });
    expect(parsed.sheets[0].rows[0].cells[1]).toEqual({ value: 100 });
  });

  it("preserves cell options (role, background, source) when present", () => {
    const parsed = enterpriseReportSchema.parse({
      title: "X",
      sheets: [
        {
          name: "A",
          columns,
          rows: [
            [
              { value: "Rev", role: "input" as const, source: "10-K" },
              { value: "=SUM(B2:B5)", role: "formula" as const },
            ],
          ],
        },
      ],
    });
    expect(parsed.sheets[0].rows[0].cells[0].role).toBe("input");
    expect(parsed.sheets[0].rows[0].cells[0].source).toBe("10-K");
    expect(parsed.sheets[0].rows[0].cells[1].value).toBe("=SUM(B2:B5)");
  });

  it("rejects when required fields are missing", () => {
    const res = enterpriseReportSchema.safeParse({ title: "X" });
    expect(res.success).toBe(false);
  });
});
