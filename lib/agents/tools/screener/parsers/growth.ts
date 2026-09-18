// lib/agents/tools/screener/parsers/growth.ts
import type { CheerioAPI } from "cheerio";
import { parseNumber } from "./shared";

export type Growth = {
  salesCagr:  { "10y": number | null; "5y": number | null; "3y": number | null; ttm: number | null };
  profitCagr: { "10y": number | null; "5y": number | null; "3y": number | null; ttm: number | null };
  stockCagr:  { "10y": number | null; "5y": number | null; "3y": number | null; "1y": number | null };
  roeAvg:     { "10y": number | null; "5y": number | null; "3y": number | null; "1y": number | null };
};

/**
 * Screener renders 4 small "ranges-table" tables under the P&L section,
 * one per growth metric. Each has rows like:
 *   10 Years: 12%
 *   5 Years: 8%
 *   3 Years: 5%
 *   TTM:     3%   (or "Last Year" / "1 Year" for stockCagr / roeAvg)
 *
 * We locate each table by its preceding heading text (case-insensitive
 * substring match) so reorderings or class renames don't break us.
 */
export function parseGrowth($: CheerioAPI): Growth {
  const empty = (kind: "ttm" | "1y") => ({
    "10y": null as number | null,
    "5y":  null as number | null,
    "3y":  null as number | null,
    ...(kind === "ttm" ? { ttm: null as number | null } : { "1y": null as number | null }),
  });

  const out: Growth = {
    salesCagr:  empty("ttm")  as Growth["salesCagr"],
    profitCagr: empty("ttm")  as Growth["profitCagr"],
    stockCagr:  empty("1y")   as Growth["stockCagr"],
    roeAvg:     empty("1y")   as Growth["roeAvg"],
  };

  const headingMap: Array<{ match: string; key: keyof Growth; tail: "ttm" | "1y" }> = [
    { match: "compounded sales growth",  key: "salesCagr",  tail: "ttm" },
    { match: "compounded profit growth", key: "profitCagr", tail: "ttm" },
    { match: "stock price cagr",         key: "stockCagr",  tail: "1y" },
    { match: "return on equity",         key: "roeAvg",     tail: "1y" },
  ];

  $("#profit-loss .ranges-table, #ratios .ranges-table, .ranges-table").each((_, el) => {
    const $tbl = $(el);
    const heading = ($tbl.prev("h2, h3, .heading").text() || $tbl.find("th").first().text() || "").trim().toLowerCase();
    const target = headingMap.find((h) => heading.includes(h.match));
    if (!target) return;
    const slot = out[target.key] as Record<string, number | null>;
    $tbl.find("tbody tr").each((_, tr) => {
      const label = $(tr).find("td").first().text().trim().toLowerCase();
      const value = parseNumber($(tr).find("td").last().text());
      if (label.includes("10 year")) slot["10y"] = value;
      else if (label.includes("5 year")) slot["5y"] = value;
      else if (label.includes("3 year")) slot["3y"] = value;
      else if (label.includes("ttm")) slot["ttm"] = value;
      else if (label.includes("1 year") || label.includes("last year")) slot["1y"] = value;
    });
  });

  return out;
}
