// lib/agents/tools/screener/parsers/overview.ts
import type { CheerioAPI } from "cheerio";
import { parseNumber } from "./shared";

export type Overview = {
  marketCap: number | null;
  currentPrice: number | null;
  high52w: number | null;
  low52w: number | null;
  pe: number | null;
  pb: number | null;
  bookValue: number | null;
  dividendYield: number | null;
  roce: number | null;
  roe: number | null;
  faceValue: number | null;
};

/**
 * Reads the top-of-page ratio block. Screener renders it as
 * <ul id="top-ratios"><li><span class="name">…</span><span class="number">…</span></li>…</ul>
 * Label substrings are matched case-insensitively and order-independent so
 * Screener's occasional reorderings don't break us.
 */
export function parseOverview($: CheerioAPI): Overview {
  const out: Overview = {
    marketCap: null, currentPrice: null, high52w: null, low52w: null,
    pe: null, pb: null, bookValue: null, dividendYield: null,
    roce: null, roe: null, faceValue: null,
  };

  $("#top-ratios li").each((_, li) => {
    const $li = $(li);
    const name = $li.find(".name").text().trim().toLowerCase();
    const numText = $li.find(".number").text().trim();
    const num = parseNumber(numText);

    if (name.includes("market cap")) out.marketCap = num;
    else if (name.includes("current price")) out.currentPrice = num;
    else if (name.includes("high")) out.high52w = num;
    else if (name.includes("low")) out.low52w = num;
    else if (name.includes("stock p/e") || name === "p/e") out.pe = num;
    else if (name.includes("price to book") || name.includes("p/b")) out.pb = num;
    else if (name.includes("book value")) out.bookValue = num;
    else if (name.includes("dividend yield")) out.dividendYield = num;
    else if (name.includes("roce")) out.roce = num;
    else if (name.includes("roe")) out.roe = num;
    else if (name.includes("face value")) out.faceValue = num;
  });

  return out;
}
