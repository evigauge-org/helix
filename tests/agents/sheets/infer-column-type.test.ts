import { describe, it, expect } from "vitest";
import { inferColumnType } from "@/lib/agents/tools/sheets/infer-column-type";

describe("inferColumnType", () => {
  it.each([
    ["Revenue ($mm)", "currency"],
    ["Gross Margin %", "percent"],
    ["EV/EBITDA", "multiple"],
    ["Headcount", "integer"],
    ["Report Date", "date"],
    ["Company Name", "text"],
    ["Growth %", "percent"],
    ["Price (USD)", "currency"],
    ["Multiple (x)", "multiple"],
    ["2025 FY", "text"],
  ])("%s → %s", (header, expected) => {
    expect(inferColumnType(header)).toBe(expected);
  });
});
