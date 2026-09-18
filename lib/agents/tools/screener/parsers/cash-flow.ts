// lib/agents/tools/screener/parsers/cash-flow.ts
import type { CheerioAPI } from "cheerio";
import { pivotTable, rowsToPeriodObjects } from "./shared";

export type CashFlowRow = {
  period: string;
  fromOperating: number | null;
  fromInvesting: number | null;
  fromFinancing: number | null;
  netCashFlow: number | null;
};

const LABELS = {
  "cash from operating": "fromOperating",
  "cash from investing": "fromInvesting",
  "cash from financing": "fromFinancing",
  "net cash flow": "netCashFlow",
};

export function parseCashFlow($: CheerioAPI): CashFlowRow[] {
  const table = pivotTable($, "#cash-flow", LABELS);
  return rowsToPeriodObjects(
    table,
    ["fromOperating", "fromInvesting", "fromFinancing", "netCashFlow"],
    10,
  ) as CashFlowRow[];
}
