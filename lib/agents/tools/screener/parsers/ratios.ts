// lib/agents/tools/screener/parsers/ratios.ts
import type { CheerioAPI } from "cheerio";
import { pivotTable, rowsToPeriodObjects } from "./shared";

export type RatiosRow = {
  period: string;
  debtorDays: number | null;
  inventoryDays: number | null;
  daysPayable: number | null;
  cashConversionCycle: number | null;
  workingCapitalDays: number | null;
  roce: number | null;
};

const LABELS = {
  "debtor days": "debtorDays",
  "inventory days": "inventoryDays",
  "days payable": "daysPayable",
  "cash conversion cycle": "cashConversionCycle",
  "working capital days": "workingCapitalDays",
  "roce %": "roce",
};

export function parseRatios($: CheerioAPI): RatiosRow[] {
  const table = pivotTable($, "#ratios", LABELS);
  return rowsToPeriodObjects(
    table,
    ["debtorDays", "inventoryDays", "daysPayable", "cashConversionCycle", "workingCapitalDays", "roce"],
    10,
  ) as RatiosRow[];
}
