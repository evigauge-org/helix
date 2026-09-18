// lib/agents/tools/ib/macrotrends/scraper.ts
import * as cheerio from "cheerio";
import { browserHeaders } from "../shared/headers";
import { readCached, writeCached } from "../shared/cache";
import { withRetry } from "../shared/resilience";

const BASE = "https://www.macrotrends.net";

export type MacrotrendsRow = { date: string; value: number | null };

export async function scrapeMacrotrendsMetric(
  ticker: string,
  companySlug: string,
  metric: string,
): Promise<{ rows: MacrotrendsRow[]; sourceUrl: string }> {
  const url = `${BASE}/stocks/charts/${ticker}/${companySlug}/${metric}`;
  const key = `macrotrends:${ticker}:${metric}`;
  const cached = await readCached<{ rows: MacrotrendsRow[]; sourceUrl: string }>("macrotrends", key);
  if (cached) return cached;

  const result = await withRetry(async () => {
    const res = await fetch(url, { headers: browserHeaders({ referer: BASE }) });
    if (!res.ok) throw new Error(`macrotrends ${res.status} ${url}`);
    return await res.text();
  }, { label: `macrotrends ${ticker}/${metric}` });
  if (!result.ok) throw new Error(result.error);

  const $ = cheerio.load(result.data);
  const rows: MacrotrendsRow[] = [];
  // Macrotrends ships data tables with a `historical_data_table` class anchor.
  $("table.historical_data_table tbody tr").each((_, el) => {
    const cells = $(el).find("td");
    if (cells.length < 2) return;
    const date = $(cells[0]).text().trim();
    const raw = $(cells[1]).text().replace(/[$,B%]/g, "").trim();
    const value = raw && raw !== "-" ? Number(raw) : null;
    if (date) rows.push({ date, value });
  });
  const out = { rows, sourceUrl: url };
  await writeCached("macrotrends", key, out);
  return out;
}
