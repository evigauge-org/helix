// lib/agents/tools/ib/valuation/capacity_score.ts
// Acquirer financial-capacity scoring — does the acquirer have the firepower?

export type CapacityInputs = {
  acquirer: {
    marketCap: number;
    cashOnHand: number;
    longTermDebt: number;
    netDebt: number;
    leverageDebtToEbitda: number; // current leverage ratio
  };
  targetEv: number;
  // sectors with conventionally higher debt tolerance get higher caps; default 4.0
  maxLeverageDebtToEbitda?: number;
  acquirerEbitda: number;
};

export type CapacityResult = {
  score: number;            // 0-100
  rationale: string;
  components: {
    cashCoverage: number;   // 0-1
    debtHeadroom: number;   // 0-1
    relativeSize: number;   // 0-1 (target EV vs acquirer market cap)
  };
};

export function scoreAcquirerCapacity(input: CapacityInputs): CapacityResult {
  const maxLev = input.maxLeverageDebtToEbitda ?? 4.0;
  const cashCoverage = Math.min(1, input.acquirer.cashOnHand / Math.max(1, input.targetEv));
  const debtCapacityAbs = Math.max(0, (maxLev - input.acquirer.leverageDebtToEbitda) * input.acquirerEbitda);
  const debtHeadroom = Math.min(1, debtCapacityAbs / Math.max(1, input.targetEv));
  const relativeSize = Math.min(1, input.acquirer.marketCap / Math.max(1, input.targetEv * 3));

  const score = Math.round(100 * (0.4 * cashCoverage + 0.4 * debtHeadroom + 0.2 * relativeSize));
  const rationale = [
    `cash covers ${(cashCoverage * 100).toFixed(0)}% of target EV`,
    `incremental debt capacity covers ${(debtHeadroom * 100).toFixed(0)}% (cap ${maxLev.toFixed(1)}x leverage)`,
    `acquirer market cap is ${(input.acquirer.marketCap / input.targetEv).toFixed(1)}x target EV`,
  ].join("; ");
  return { score, rationale, components: { cashCoverage, debtHeadroom, relativeSize } };
}
