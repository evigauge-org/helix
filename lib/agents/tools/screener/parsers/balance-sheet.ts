// lib/agents/tools/screener/parsers/balance-sheet.ts
import type { CheerioAPI } from "cheerio";
import { pivotTable, rowsToPeriodObjects } from "./shared";
import type { Sector } from "../sector";

export type GenericBS = {
  period: string;
  equityCapital: number | null; reserves: number | null;
  borrowings: number | null; otherLiabilities: number | null; totalLiabilities: number | null;
  fixedAssets: number | null; cwip: number | null;
  investments: number | null; otherAssets: number | null; totalAssets: number | null;
};

export type BankingBS = {
  period: string;
  equityCapital: number | null; reserves: number | null;
  deposits: number | null; borrowings: number | null;
  otherLiabilities: number | null; totalLiabilities: number | null;
  investments: number | null; advances: number | null;
  cashAndBalanceRBI: number | null; fixedAssets: number | null;
  otherAssets: number | null; totalAssets: number | null;
};

const GENERIC_LABELS = {
  "equity capital": "equityCapital",
  "reserves": "reserves",
  "borrowings": "borrowings",
  "other liabilities": "otherLiabilities",
  "total liabilities": "totalLiabilities",
  "fixed assets": "fixedAssets",
  "cwip": "cwip",
  "investments": "investments",
  "other assets": "otherAssets",
  "total assets": "totalAssets",
};

const BANKING_LABELS = {
  "equity capital": "equityCapital",
  "reserves": "reserves",
  "deposits": "deposits",
  "borrowings": "borrowings",
  "other liabilities": "otherLiabilities",
  "total liabilities": "totalLiabilities",
  "investments": "investments",
  "advances": "advances",
  "cash and balance with rbi": "cashAndBalanceRBI",
  "fixed assets": "fixedAssets",
  "other assets": "otherAssets",
  "total assets": "totalAssets",
};

const FIELDS = {
  generic: ["equityCapital", "reserves", "borrowings", "otherLiabilities", "totalLiabilities", "fixedAssets", "cwip", "investments", "otherAssets", "totalAssets"],
  banking: ["equityCapital", "reserves", "deposits", "borrowings", "otherLiabilities", "totalLiabilities", "investments", "advances", "cashAndBalanceRBI", "fixedAssets", "otherAssets", "totalAssets"],
} as const;

export function parseBalanceSheet($: CheerioAPI, sector: Sector): GenericBS[] | BankingBS[] {
  // NBFC balance sheet matches generic structurally — same label set works.
  const labels = sector === "banking" ? BANKING_LABELS : GENERIC_LABELS;
  const fields = sector === "banking" ? FIELDS.banking : FIELDS.generic;
  const table = pivotTable($, "#balance-sheet", labels);
  return rowsToPeriodObjects(table, [...fields], 10) as never;
}
