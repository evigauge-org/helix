// tests/store-builder/markets.test.ts
import { describe, it, expect } from "vitest";
import {
  MARKET_CURRENCY,
  MARKET_SEGMENT_DESCRIPTIONS,
  resolveMarket,
  getCurrency,
  isFirstClassMarket,
} from "@/lib/store-builder/markets";

describe("MARKET_CURRENCY", () => {
  it("has all 10 first-class markets", () => {
    expect(Object.keys(MARKET_CURRENCY).sort()).toEqual(
      ["ae", "au", "ca", "eu", "global", "in", "jp", "sg", "uk", "us"],
    );
  });

  it("india maps to INR", () => {
    expect(MARKET_CURRENCY.in).toEqual({ code: "INR", symbol: "₹", name: "Indian Rupee" });
  });

  it("global defaults to USD", () => {
    expect(MARKET_CURRENCY.global.code).toBe("USD");
  });
});

describe("MARKET_SEGMENT_DESCRIPTIONS", () => {
  it("covers all four segments", () => {
    expect(Object.keys(MARKET_SEGMENT_DESCRIPTIONS).sort()).toEqual(
      ["budget", "luxury", "mid", "premium"],
    );
  });
});

describe("resolveMarket", () => {
  it("returns the currency entry for first-class codes", () => {
    expect(resolveMarket("uk")).toEqual({ code: "GBP", symbol: "£", name: "Pound Sterling" });
  });

  it("falls back to USD for unknown codes", () => {
    const fallback = resolveMarket("mx");
    expect(fallback.code).toBe("USD");
    expect(fallback.name).toContain("fallback");
  });
});

describe("getCurrency", () => {
  it("returns currency code for first-class market", () => {
    expect(getCurrency("in")).toBe("INR");
  });
  it("returns USD for unknown", () => {
    expect(getCurrency("zz")).toBe("USD");
  });
});

describe("isFirstClassMarket", () => {
  it("true for us/in/global", () => {
    expect(isFirstClassMarket("us")).toBe(true);
    expect(isFirstClassMarket("in")).toBe(true);
    expect(isFirstClassMarket("global")).toBe(true);
  });
  it("false for arbitrary strings", () => {
    expect(isFirstClassMarket("brazil")).toBe(false);
  });
});
