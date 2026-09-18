// lib/agents/tools/screener/parsers/peers.ts
import type { CheerioAPI } from "cheerio";
import { parseNumber } from "./shared";

export type PeerRow = {
  name: string;
  marketCap: number | null;
  cmp: number | null;
  pe: number | null;
  pb: number | null;
  divYield: number | null;
  npQtr: number | null;
  qtrProfitVarPct: number | null;
  salesQtr: number | null;
  qtrSalesVarPct: number | null;
  roce: number | null;
};

const HEADER_MAP: Record<string, keyof Omit<PeerRow, "name">> = {
  "market cap": "marketCap",
  "cmp": "cmp",
  "p/e": "pe",
  "p/b": "pb",
  "div yld": "divYield",
  "dividend yield": "divYield",
  "np qtr": "npQtr",
  "qtr profit var": "qtrProfitVarPct",
  "sales qtr": "salesQtr",
  "qtr sales var": "qtrSalesVarPct",
  "roce": "roce",
};

/**
 * Reads #peers .data-table. The header columns vary across pages, so we
 * build a column-index → field map by inspecting the headers row, then
 * project each tbody row through it.
 */
export function parsePeers($: CheerioAPI): PeerRow[] {
  const $section = $("#peers table.data-table");
  if ($section.length === 0) return [];

  const colToField: Record<number, keyof Omit<PeerRow, "name">> = {};
  $section.find("thead th").each((idx, th) => {
    const t = $(th).text().trim().toLowerCase();
    for (const [substring, field] of Object.entries(HEADER_MAP)) {
      if (t.includes(substring)) {
        colToField[idx] = field;
        break;
      }
    }
  });

  const out: PeerRow[] = [];
  $section.find("tbody tr").each((_, tr) => {
    const $tds = $(tr).find("td");
    if ($tds.length < 2) return;
    // First column is usually a serial number; second is the company link.
    const name = $tds
      .eq(1)
      .find("a")
      .first()
      .text()
      .trim() || $tds.eq(1).text().trim();
    if (!name) return;
    const row: PeerRow = {
      name, marketCap: null, cmp: null, pe: null, pb: null, divYield: null,
      npQtr: null, qtrProfitVarPct: null, salesQtr: null, qtrSalesVarPct: null, roce: null,
    };
    $tds.each((idx, td) => {
      const field = colToField[idx];
      if (!field) return;
      (row as unknown as Record<string, number | null>)[field] = parseNumber($(td).text());
    });
    out.push(row);
    if (out.length >= 10) return false;
  });
  return out;
}
