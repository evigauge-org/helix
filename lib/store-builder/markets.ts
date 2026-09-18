// lib/store-builder/markets.ts
import type { MarketSegment } from "./types";

export interface MarketCurrency {
  code: string;
  symbol: string;
  name: string;
}

export const MARKET_CURRENCY: Record<string, MarketCurrency> = {
  us:     { code: "USD", symbol: "$",   name: "US Dollar" },
  uk:     { code: "GBP", symbol: "£",   name: "Pound Sterling" },
  eu:     { code: "EUR", symbol: "€",   name: "Euro" },
  in:     { code: "INR", symbol: "₹",   name: "Indian Rupee" },
  ae:     { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
  au:     { code: "AUD", symbol: "A$",  name: "Australian Dollar" },
  ca:     { code: "CAD", symbol: "C$",  name: "Canadian Dollar" },
  jp:     { code: "JPY", symbol: "¥",   name: "Japanese Yen" },
  sg:     { code: "SGD", symbol: "S$",  name: "Singapore Dollar" },
  global: { code: "USD", symbol: "$",   name: "US Dollar (default for Global)" },
};

export const MARKET_SEGMENT_DESCRIPTIONS: Record<MarketSegment, string> = {
  budget:  "mass-market, price-sensitive buyers",
  mid:     "value-oriented, balances quality and cost",
  premium: "quality-first, willing to pay more for craftsmanship / features",
  luxury:  "exclusivity-first, premium experience expected",
};

const FALLBACK_CURRENCY: MarketCurrency = {
  code: "USD",
  symbol: "$",
  name: "US Dollar (fallback for unknown market)",
};

export function isFirstClassMarket(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(MARKET_CURRENCY, code);
}

export function resolveMarket(code: string): MarketCurrency {
  return MARKET_CURRENCY[code] ?? FALLBACK_CURRENCY;
}

export function getCurrency(code: string): string {
  return resolveMarket(code).code;
}
