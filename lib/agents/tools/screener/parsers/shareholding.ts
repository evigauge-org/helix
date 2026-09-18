// lib/agents/tools/screener/parsers/shareholding.ts
import type { CheerioAPI } from "cheerio";
import { pivotTable, rowsToPeriodObjects } from "./shared";

export type ShareholdingRow = {
  period: string;
  promoters: number | null;
  fii: number | null;
  dii: number | null;
  public: number | null;
  government: number | null;
};

export type Shareholding = {
  asOf: string;
  promoters: number | null;
  fii: number | null;
  dii: number | null;
  public: number | null;
  government: number | null;
  history: ShareholdingRow[];
};

const LABELS = {
  "promoters": "promoters",
  "fiis": "fii",
  "fii": "fii",
  "diis": "dii",
  "dii": "dii",
  "public": "public",
  "government": "government",
};

export function parseShareholding($: CheerioAPI): Shareholding {
  const table = pivotTable($, "#shareholding", LABELS);
  const periods = (table._periods as string[]) ?? [];
  const history = rowsToPeriodObjects(
    table,
    ["promoters", "fii", "dii", "public", "government"],
    8,
  ) as ShareholdingRow[];
  const last = history[history.length - 1];
  return {
    asOf: periods[periods.length - 1] ?? "",
    promoters: last?.promoters ?? null,
    fii: last?.fii ?? null,
    dii: last?.dii ?? null,
    public: last?.public ?? null,
    government: last?.government ?? null,
    history,
  };
}
