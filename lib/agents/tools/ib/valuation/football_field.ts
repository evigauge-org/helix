// lib/agents/tools/ib/valuation/football_field.ts
// Pure-TS implementation of the 3-method valuation football field.
// Inputs come from agent-collected data; no external calls.

export type FootballFieldInputs = {
  targetMetrics: { revenue: number; ebitda: number; netIncome: number; currency: string };
  tradingComps: { evRevenueLow: number; evRevenueHigh: number; evEbitdaLow: number; evEbitdaHigh: number };
  precedentTxns: { evRevenueLow: number; evRevenueHigh: number; evEbitdaLow: number; evEbitdaHigh: number };
  dcfInputs: { lowEv: number; baseEv: number; highEv: number };
};

export type FootballFieldRange = { method: string; low: number; mid: number; high: number };

export function buildFootballField(input: FootballFieldInputs): {
  ranges: FootballFieldRange[];
  overallLow: number;
  overallHigh: number;
} {
  const { targetMetrics, tradingComps, precedentTxns, dcfInputs } = input;
  const ranges: FootballFieldRange[] = [
    {
      method: "Trading comps — EV/Revenue",
      low: tradingComps.evRevenueLow * targetMetrics.revenue,
      mid: ((tradingComps.evRevenueLow + tradingComps.evRevenueHigh) / 2) * targetMetrics.revenue,
      high: tradingComps.evRevenueHigh * targetMetrics.revenue,
    },
    {
      method: "Trading comps — EV/EBITDA",
      low: tradingComps.evEbitdaLow * targetMetrics.ebitda,
      mid: ((tradingComps.evEbitdaLow + tradingComps.evEbitdaHigh) / 2) * targetMetrics.ebitda,
      high: tradingComps.evEbitdaHigh * targetMetrics.ebitda,
    },
    {
      method: "Precedent txns — EV/Revenue",
      low: precedentTxns.evRevenueLow * targetMetrics.revenue,
      mid: ((precedentTxns.evRevenueLow + precedentTxns.evRevenueHigh) / 2) * targetMetrics.revenue,
      high: precedentTxns.evRevenueHigh * targetMetrics.revenue,
    },
    {
      method: "Precedent txns — EV/EBITDA",
      low: precedentTxns.evEbitdaLow * targetMetrics.ebitda,
      mid: ((precedentTxns.evEbitdaLow + precedentTxns.evEbitdaHigh) / 2) * targetMetrics.ebitda,
      high: precedentTxns.evEbitdaHigh * targetMetrics.ebitda,
    },
    {
      method: "DCF",
      low: dcfInputs.lowEv,
      mid: dcfInputs.baseEv,
      high: dcfInputs.highEv,
    },
  ];
  const overallLow = Math.min(...ranges.map((r) => r.low));
  const overallHigh = Math.max(...ranges.map((r) => r.high));
  return { ranges, overallLow, overallHigh };
}
