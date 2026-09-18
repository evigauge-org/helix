import { describe, it, expect } from "vitest";
import { normalizeOptionChain } from "@/lib/agents/tools/markets/option-chain-normalizer";

const fixture = {
  records: {
    underlyingValue: 100,
    expiryDates: ["2026-04-30", "2026-05-29"],
    data: [
      {
        strikePrice: 95,
        expiryDate: "2026-04-30",
        CE: { lastPrice: 6.5, impliedVolatility: 22.1, openInterest: 1500, totalTradedVolume: 320, bidprice: 6.4, askPrice: 6.6 },
        PE: { lastPrice: 1.1, impliedVolatility: 23.2, openInterest: 800, totalTradedVolume: 90, bidprice: 1.0, askPrice: 1.2 },
      },
      {
        strikePrice: 100,
        expiryDate: "2026-04-30",
        CE: { lastPrice: 3.5, impliedVolatility: 21.0, openInterest: 4500, totalTradedVolume: 1200, bidprice: 3.4, askPrice: 3.6 },
        PE: { lastPrice: 3.0, impliedVolatility: 21.5, openInterest: 4200, totalTradedVolume: 1100, bidprice: 2.9, askPrice: 3.1 },
      },
      {
        strikePrice: 105,
        expiryDate: "2026-04-30",
        CE: { lastPrice: 1.6, impliedVolatility: 23.4, openInterest: 1100, totalTradedVolume: 280, bidprice: 1.5, askPrice: 1.7 },
        PE: { lastPrice: 5.8, impliedVolatility: 24.5, openInterest: 900, totalTradedVolume: 220, bidprice: 5.7, askPrice: 5.9 },
      },
    ],
  },
};

describe("normalizeOptionChain", () => {
  it("extracts spot, expiries, and strike grid", () => {
    const r = normalizeOptionChain(fixture as never, "NIFTY");
    expect(r.underlying).toBe("NIFTY");
    expect(r.spot).toBe(100);
    expect(r.expiries).toEqual(["2026-04-30", "2026-05-29"]);
    expect(r.strikes).toHaveLength(3);
    expect(r.strikes[0]).toEqual({
      strike: 95,
      call: { ltp: 6.5, iv: 22.1, oi: 1500, vol: 320, bid: 6.4, ask: 6.6 },
      put: { ltp: 1.1, iv: 23.2, oi: 800, vol: 90, bid: 1.0, ask: 1.2 },
    });
  });

  it("filters strikes around ATM by default to 20 (no-op when fewer)", () => {
    const r = normalizeOptionChain(fixture as never, "NIFTY", { count: 20 });
    expect(r.strikes).toHaveLength(3);
  });

  it("trims strikes around explicit center", () => {
    const r = normalizeOptionChain(fixture as never, "NIFTY", { center: 100, count: 1 });
    expect(r.strikes.map((s) => s.strike)).toEqual([100]);
  });

  it("returns empty strikes when records.data is missing", () => {
    const r = normalizeOptionChain({ records: { underlyingValue: 50, expiryDates: [] } } as never, "FOO");
    expect(r.strikes).toEqual([]);
    expect(r.spot).toBe(50);
  });
});
