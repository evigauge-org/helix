// lib/agents/tools/screener/sector.ts
import type { CheerioAPI } from "cheerio";

export type Sector = "generic" | "banking" | "nbfc";

/**
 * Inspect P&L row labels to classify the company. Banking rows include
 * "Interest Earned" / "Net Interest Income"; NBFCs use "Financing Profit"
 * / "Financing Margin". Anything else is generic.
 */
export function detectSector($: CheerioAPI): Sector {
  const labels = $("#profit-loss table.data-table tbody tr td:first-child")
    .map((_, td) => $(td).text().trim().toLowerCase())
    .get();

  if (labels.some((l) => l.includes("financing profit") || l.includes("financing margin"))) {
    return "nbfc";
  }
  if (labels.some((l) => l.includes("interest earned") || l.includes("net interest income"))) {
    return "banking";
  }
  return "generic";
}
