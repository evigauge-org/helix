// lib/agents/tools/insurance/insurers/pnb-metlife.ts
import * as cheerio from "cheerio";
import type { InsurerCatalogEntry, DiscoveredFactsheet } from "../shared/types";
import { genericLocator } from "../shared/fallback";

async function discover(html: string, monthOpt: string | "latest"): Promise<DiscoveredFactsheet | null> {
  const $ = cheerio.load(html);
  const candidates: Array<{ url: string; label: string }> = [];
  $('a[href$=".pdf"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const label = ($(el).text() || "").trim();
    if (!/(factsheet|fund-information|investment)/i.test(`${href} ${label}`)) return;
    const abs = href.startsWith("http") ? href : `https://www.pnbmetlife.com${href.startsWith("/") ? "" : "/"}${href}`;
    candidates.push({ url: abs, label });
  });
  if (candidates.length === 0) return null;

  if (monthOpt === "latest") {
    return { pdfUrl: candidates[0].url, monthLabel: parseMonth(candidates[0]), source: "catalog" };
  }
  const target = candidates.find((c) => matchMonth(c, monthOpt));
  return target ? { pdfUrl: target.url, monthLabel: monthOpt, source: "catalog" } : null;
}

function parseMonth(c: { url: string; label: string }): string {
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const m = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\-_ ]?(\d{4})/i.exec(`${c.url} ${c.label}`);
  if (m) {
    const idx = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(m[1].toLowerCase().slice(0,3));
    if (idx >= 0) return `${months[idx]} ${m[2]}`;
  }
  return "Latest";
}

function matchMonth(c: { url: string; label: string }, monthYyyymm: string): boolean {
  const [year, mm] = monthYyyymm.split("-");
  const monthIdx = parseInt(mm, 10) - 1;
  const short = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"][monthIdx] ?? "";
  if (!short) return false;
  return new RegExp(`${short}[a-z]*[\\-_ ]?${year}`, "i").test(`${c.url} ${c.label}`);
}

export const pnbMetlifeEntry: InsurerCatalogEntry = {
  slug: "pnb-metlife",
  displayName: "PNB MetLife",
  domain: "pnbmetlife.com",
  landingUrl: "https://www.pnbmetlife.com/funds/fund-information.html",
  discover,
  locator: genericLocator,
};
