// lib/agents/tools/screener/parsers/shared.ts
import type { CheerioAPI } from "cheerio";

/**
 * Parse a Screener-formatted number. Handles "1,234.56", "1,234.56 Cr",
 * "₹1,234.56", "45.2%", "-", "", non-breaking spaces. Returns number | null.
 */
export function parseNumber(raw: string | undefined | null): number | null {
  if (!raw) return null;
  // Normalize NBSP ( ; Screener uses it between number and unit, e.g. "1,234 Cr") to a regular space.
  let s = raw.replace(/ /g, " ").trim();
  if (!s || s === "-" || s === "—" || s.toLowerCase() === "n/a") return null;
  s = s.replace(/[₹$£€]/g, "");
  s = s.replace(/\b(cr|crore|crores|lakh|lakhs|%|pct|days)\b/gi, "");
  s = s.replace(/,/g, "").trim();
  const neg = s.startsWith("(") && s.endsWith(")");
  if (neg) s = s.slice(1, -1);
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

/**
 * Pivot a Screener "data-table" with periods across the header and metric
 * labels in the first column of each body row. Returns:
 *   _periods: ["Mar 2024", "Mar 2025", ...]
 *   <field>: [<num | null>, ...]   — one entry per period, indexed by header order
 *
 * `labelMap` keys are LOWER-CASE substrings to match against the row label;
 * the first matching key wins. Unmatched rows are ignored.
 */
export function pivotTable(
  $: CheerioAPI,
  sectionSelector: string,
  labelMap: Record<string, string>,
): Record<string, Array<number | null> | string[]> {
  const $section = $(`${sectionSelector} table.data-table`);
  const periods: string[] = [];
  $section.find("thead th").slice(1).each((_, th) => {
    periods.push($(th).text().trim());
  });

  const rows: Record<string, Array<number | null> | string[]> = { _periods: periods };
  const entries = Object.entries(labelMap);

  $section.find("tbody tr").each((_, tr) => {
    const $tr = $(tr);
    const labelText = $tr.find("td").first().text().trim().toLowerCase();
    let outputField: string | null = null;
    for (const [substring, field] of entries) {
      if (labelText.includes(substring)) {
        outputField = field;
        break;
      }
    }
    if (!outputField) return;
    const values: Array<number | null> = [];
    $tr.find("td").slice(1).each((_, td) => {
      values.push(parseNumber($(td).text()));
    });
    rows[outputField] = values;
  });

  return rows;
}

/**
 * Project a pivot result into an array of period-keyed objects.
 * `take` keeps the latest N periods (default = all).
 */
export function rowsToPeriodObjects(
  table: Record<string, Array<number | null> | string[]>,
  fields: string[],
  take = Infinity,
): Array<Record<string, unknown>> {
  const periods = (table._periods as string[]) ?? [];
  const out: Array<Record<string, unknown>> = [];
  const start = Math.max(0, periods.length - take);
  for (let i = start; i < periods.length; i++) {
    const obj: Record<string, unknown> = { period: periods[i] };
    for (const f of fields) {
      const arr = table[f] as Array<number | null> | undefined;
      obj[f] = arr?.[i] ?? null;
    }
    out.push(obj);
  }
  return out;
}
