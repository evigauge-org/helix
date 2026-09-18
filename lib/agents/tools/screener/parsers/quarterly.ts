// lib/agents/tools/screener/parsers/quarterly.ts
import type { CheerioAPI } from "cheerio";
import { pivotTable, rowsToPeriodObjects } from "./shared";
import type { Sector } from "../sector";
import type { GenericPL, BankingPL, NBFCPL } from "./profit-loss";

const GENERIC_LABELS = {
  "sales": "sales",
  "revenue": "sales",
  "expenses": "expenses",
  "operating profit": "operatingProfit",
  "opm %": "opm",
  "other income": "otherIncome",
  "interest": "interest",
  "depreciation": "depreciation",
  "profit before tax": "profitBeforeTax",
  "tax %": "tax",
  "net profit": "netProfit",
  "eps in rs": "eps",
};

const BANKING_LABELS = {
  "interest earned": "interestEarned",
  "interest expended": "interestExpended",
  "net interest income": "netInterestIncome",
  "other income": "otherIncome",
  "operating expenses": "operatingExpenses",
  "operating profit": "operatingProfit",
  "provisions": "provisions",
  "profit before tax": "profitBeforeTax",
  "tax %": "tax",
  "net profit": "netProfit",
  "eps in rs": "eps",
};

const NBFC_LABELS = {
  "revenue": "revenue",
  "sales": "revenue",
  "interest": "interest",
  "expenses": "expenses",
  "financing profit": "financingProfit",
  "financing margin": "financingMargin",
  "other income": "otherIncome",
  "depreciation": "depreciation",
  "profit before tax": "profitBeforeTax",
  "tax %": "tax",
  "net profit": "netProfit",
  "eps in rs": "eps",
};

const FIELDS = {
  generic: ["sales", "expenses", "operatingProfit", "opm", "otherIncome", "interest", "depreciation", "profitBeforeTax", "tax", "netProfit", "eps"],
  banking: ["interestEarned", "interestExpended", "netInterestIncome", "otherIncome", "operatingExpenses", "operatingProfit", "provisions", "profitBeforeTax", "tax", "netProfit", "eps"],
  nbfc:    ["revenue", "interest", "expenses", "financingProfit", "financingMargin", "otherIncome", "depreciation", "profitBeforeTax", "tax", "netProfit", "eps"],
} as const;

/**
 * Quarterly results table at #quarters. Same row-label vocabulary as the
 * yearly P&L (minus dividendPayout which only appears in the yearly view).
 * Returns sector-typed rows; the top-level `sector` field on the tool's
 * result discriminates which shape the LLM sees.
 */
export function parseQuarterly(
  $: CheerioAPI,
  sector: Sector,
): Array<Omit<GenericPL, "dividendPayout"> | BankingPL | NBFCPL> {
  const labels =
    sector === "banking" ? BANKING_LABELS :
    sector === "nbfc"    ? NBFC_LABELS    :
    GENERIC_LABELS;
  const fields = FIELDS[sector];
  const table = pivotTable($, "#quarters", labels);
  return rowsToPeriodObjects(table, [...fields], 5) as never;
}
