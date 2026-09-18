// lib/agents/tools/ib/crunchbase/scraper.ts
import * as cheerio from "cheerio";
import { browserHeaders } from "../shared/headers";
import { readCached, writeCached } from "../shared/cache";
import { withRetry } from "../shared/resilience";

const BASE = "https://www.crunchbase.com";

export type CrunchbaseCompany = {
  slug: string;
  name: string;
  description: string | null;
  headquarters: string | null;
  founded: string | null;
  totalFunding: string | null;
  numEmployees: string | null;
  acquisitions: string[];
  sourceUrl: string;
};

export async function scrapeCrunchbase(slug: string): Promise<CrunchbaseCompany> {
  const url = `${BASE}/organization/${slug}`;
  const key = `crunchbase:${slug}`;
  const cached = await readCached<CrunchbaseCompany>("crunchbase", key);
  if (cached) return cached;

  const result = await withRetry(async () => {
    const res = await fetch(url, { headers: browserHeaders({ referer: BASE }) });
    if (!res.ok) throw new Error(`crunchbase ${res.status} ${url}`);
    return await res.text();
  }, { label: `crunchbase ${slug}` });
  if (!result.ok) throw new Error(result.error);

  const $ = cheerio.load(result.data);
  const out: CrunchbaseCompany = {
    slug,
    name: $("h1").first().text().trim() || slug,
    description: $('section[class*="description"]').text().trim() || null,
    headquarters: $('label-with-icon:contains("Headquarters")').next().text().trim() || null,
    founded: $('label-with-icon:contains("Founded")').next().text().trim() || null,
    totalFunding: $('label-with-icon:contains("Total Funding")').next().text().trim() || null,
    numEmployees: $('label-with-icon:contains("Employees")').next().text().trim() || null,
    acquisitions: [],
    sourceUrl: url,
  };
  $('section[class*="acquisitions"] a[href*="/organization/"]').each((_, el) => {
    const t = $(el).text().trim();
    if (t) out.acquisitions.push(t);
  });
  await writeCached("crunchbase", key, out);
  return out;
}
