// lib/agents/tools/screener/parsers/profit-loss.ts
import type { CheerioAPI } from "cheerio";
import { pivotTable, rowsToPeriodObjects } from "./shared";
import type { Sector } from "../sector";

export type GenericPL = {
  period: string;
  sales: number | null; expenses: number | null;
  operatingProfit: number | null; opm: number | null;
  otherIncome: number | null; interest: number | null; depreciation: number | null;
  profitBeforeTax: number | null; tax: number | null;
  netProfit: number | null; eps: number | null;
  dividendPayout: number | null;
};

export type BankingPL = {
  period: string;
  interestEarned: number | null; interestExpended: number | null;
  netInterestIncome: number | null;
  otherIncome: number | null;
  operatingExpenses: number | null; operatingProfit: number | null;
  provisions: number | null;
  profitBeforeTax: number | null; tax: number | null;
  netProfit: number | null; eps: number | null;
};

export type NBFCPL = {
  period: string;
  revenue: number | null; interest: number | null; expenses: number | null;
  financingProfit: number | null; financingMargin: number | null;
  otherIncome: number | null; depreciation: number | null;
  profitBeforeTax: number | null; tax: number | null;
  netProfit: number | null; eps: number | null;
};

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
  "dividend payout": "dividendPayout",
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
  generic: ["sales", "expenses", "operatingProfit", "opm", "otherIncome", "interest", "depreciation", "profitBeforeTax", "tax", "netProfit", "eps", "dividendPayout"],
  banking: ["interestEarned", "interestExpended", "netInterestIncome", "otherIncome", "operatingExpenses", "operatingProfit", "provisions", "profitBeforeTax", "tax", "netProfit", "eps"],
  nbfc:    ["revenue", "interest", "expenses", "financingProfit", "financingMargin", "otherIncome", "depreciation", "profitBeforeTax", "tax", "netProfit", "eps"],
} as const;

export function parseProfitLoss($: CheerioAPI, sector: Sector): GenericPL[] | BankingPL[] | NBFCPL[] {
  const labels =
    sector === "banking" ? BANKING_LABELS :
    sector === "nbfc"    ? NBFC_LABELS    :
    GENERIC_LABELS;
  const fields = FIELDS[sector];
  const table = pivotTable($, "#profit-loss", labels);
  return rowsToPeriodObjects(table, [...fields], 10) as never;
}
