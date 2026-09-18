import { describe, it, expect } from "vitest";
import { detectExchange } from "@/lib/agents/tools/markets/symbol-routing";

describe("detectExchange", () => {
  // "auto" mode is heuristic only. Bare uppercase tickers like AAPL vs RELIANCE
  // are indistinguishable lexically — agents must pass `exchange` explicitly when
  // ambiguity matters. We default bare tickers to NSE (primary user base).
  it.each([
    ["RELIANCE", "nse"],
    ["TCS", "nse"],
    ["^NSEI", "nse"],
    ["^NSEBANK", "nse"],
    ["SILVER", "nse"],
    ["AAPL", "nse"], // ambiguous bare ticker — defaults to NSE; pass exchange="yahoo" explicitly for US
    ["BTC-USD", "yahoo"],
    ["EURUSD=X", "yahoo"],
    ["SI=F", "yahoo"],
    ["TCS.NS", "yahoo"], // Yahoo's Indian ticker syntax
  ])("detectExchange(%s) === %s", (sym, exch) => {
    expect(detectExchange(sym)).toBe(exch);
  });
});
