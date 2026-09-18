// lib/agents/tools/ib/precedent_txns/extract.ts
// Given a deal URL (S-4, DEFM14A, 8-K, or press release), pull structured terms.
// Strategy: fetch the page, regex-extract financial terms, then ask the LLM
// (via the agent's run loop, not directly here) to confirm/clean.
//
// This file does only the deterministic regex pass; LLM cleanup is left to
// the agent's prompt — keeps this tool fast and deterministic.

import * as cheerio from "cheerio";
import { browserHeaders } from "../shared/headers";
import { withRetry } from "../shared/resilience";

export type ExtractedDeal = {
  acquirer: string | null;
  target: string | null;
  announceDate: string | null;
  enterpriseValueUsd: number | null;
  evRevenueMultiple: number | null;
  evEbitdaMultiple: number | null;
  premiumPct: number | null;
  structure: "cash" | "stock" | "mix" | null;
  rawSnippet: string;
  sourceUrl: string;
};

const MONEY_RE = /\$([\d,.]+)\s*(billion|million|bn|mn|m|b)\b/gi;
const PREMIUM_RE = /(\d{1,3}(?:\.\d+)?)\s*%\s*premium/i;
const MULT_RE = /(\d{1,3}(?:\.\d+)?)\s*x\s*(revenue|sales|ebitda)/gi;

function moneyToUsd(amount: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u === "billion" || u === "bn" || u === "b") return amount * 1e9;
  if (u === "million" || u === "mn" || u === "m") return amount * 1e6;
  return amount;
}

export async function extractDealTermsFromUrl(url: string): Promise<ExtractedDeal> {
  const result = await withRetry(async () => {
    const res = await fetch(url, { headers: browserHeaders() });
    if (!res.ok) throw new Error(`extract ${res.status} ${url}`);
    return await res.text();
  }, { label: `extract ${url}` });
  if (!result.ok) throw new Error(result.error);

  const $ = cheerio.load(result.data);
  const text = $("body").text().replace(/\s+/g, " ").slice(0, 20000);

  let evUsd: number | null = null;
  const moneyMatches = Array.from(text.matchAll(MONEY_RE));
  if (moneyMatches.length > 0) {
    const m = moneyMatches[0];
    evUsd = moneyToUsd(Number(m[1].replace(/,/g, "")), m[2]);
  }

  const premiumMatch = PREMIUM_RE.exec(text);
  const premium = premiumMatch ? Number(premiumMatch[1]) : null;

  let evRev: number | null = null;
  let evEbitda: number | null = null;
  for (const m of text.matchAll(MULT_RE)) {
    const mult = Number(m[1]);
    const which = m[2].toLowerCase();
    if (which.startsWith("rev") || which.startsWith("sale")) evRev = mult;
    if (which.startsWith("ebitda")) evEbitda = mult;
  }

  let structure: ExtractedDeal["structure"] = null;
  if (/all[-\s]?cash/i.test(text)) structure = "cash";
  else if (/all[-\s]?stock/i.test(text)) structure = "stock";
  else if (/cash[-\s]and[-\s]stock|mix(ed)?\s*consideration/i.test(text)) structure = "mix";

  const titleEl = $("title").text();
  const titleParts = titleEl.split(/\s+(?:to acquire|acquires|merger with|combination with)\s+/i);

  return {
    acquirer: titleParts[0]?.trim() || null,
    target: titleParts[1]?.trim() || null,
    announceDate: null,
    enterpriseValueUsd: evUsd,
    evRevenueMultiple: evRev,
    evEbitdaMultiple: evEbitda,
    premiumPct: premium,
    structure,
    rawSnippet: text.slice(0, 800),
    sourceUrl: url,
  };
}
