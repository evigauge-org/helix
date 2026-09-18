// lib/agents/templates/ib-shared/output-schemas.ts
// Shared zod schemas. Every IB sub-agent's outputSchema imports from here.

import { z } from "zod";

export const sourceListSchema = z.array(z.string().url().or(z.string().regex(/.+:\d+$/)));

// A "cell" = one fact with a confidence + sources. Every numeric claim is wrapped
// in this so the citation/no-fabrication invariants are enforced by the schema.
export const numericCellSchema = z.object({
  value: z.union([z.number(), z.literal("Not disclosed")]),
  unit: z.string().optional(),
  sources: sourceListSchema,
  _confidence: z.enum(["high", "medium", "low"]),
});

export const stringCellSchema = z.object({
  value: z.string(),
  sources: sourceListSchema,
  _confidence: z.enum(["high", "medium", "low"]),
});

export const targetProfileSchema = z.object({
  company: z.object({
    name: z.string(),
    ticker: z.string().optional(),
    cik: z.string().optional(),
    sector: z.string().optional(),
    headquarters: z.string().optional(),
  }),
  financials: z.object({
    revenue: numericCellSchema,
    ebitda: numericCellSchema,
    netIncome: numericCellSchema,
    grossMargin: numericCellSchema,
    operatingMargin: numericCellSchema,
  }),
  segments: z.array(z.object({
    name: z.string(),
    revenue: numericCellSchema,
    description: z.string(),
  })),
  ownership: z.array(z.object({
    holder: z.string(),
    pctHeld: numericCellSchema,
  })),
  keyDrivers: z.array(stringCellSchema),
});

export const acquirerCandidateSchema = z.object({
  name: z.string(),
  ticker: z.string().optional(),
  rationale: z.string(),
  sectorFit: z.enum(["high", "medium", "low"]),
  geographyFit: z.enum(["high", "medium", "low"]),
  sizeCapacity: z.enum(["high", "medium", "low"]),
  priorMaActivity: z.string(),
  sources: sourceListSchema,
});

export const acquirerScreenerSchema = z.object({
  candidates: z.array(acquirerCandidateSchema).min(8).max(20),
  screeningCriteria: z.string(),
});

export const acquirerDeepDiveSchema = z.object({
  acquirer: z.object({ name: z.string(), ticker: z.string().optional() }),
  financialSnapshot: z.object({
    marketCap: numericCellSchema,
    enterpriseValue: numericCellSchema,
    cashOnHand: numericCellSchema,
    longTermDebt: numericCellSchema,
    leverageDebtToEbitda: numericCellSchema,
  }),
  capacityScore: z.object({ score: z.number(), rationale: z.string() }),
  priorMaHistory: z.array(z.object({
    target: z.string(),
    year: z.number(),
    enterpriseValue: numericCellSchema,
    sources: sourceListSchema,
  })),
  strategicFitThesis: stringCellSchema,
  dealStructurePreference: stringCellSchema,
});

export const compTransactionsSchema = z.object({
  scope: z.object({
    sectorKeywords: z.array(z.string()),
    fromDate: z.string(),
    toDate: z.string(),
    sizeBand: z.string(),
  }),
  deals: z.array(z.object({
    acquirer: z.string(),
    target: z.string(),
    announceDate: z.string(),
    enterpriseValue: numericCellSchema,
    evRevenueMultiple: numericCellSchema,
    evEbitdaMultiple: numericCellSchema,
    premiumPct: numericCellSchema,
    structure: z.enum(["cash", "stock", "mix", "Not disclosed"]),
    sources: sourceListSchema,
  })).min(3),
  summaryStats: z.object({
    medianEvRevenue: z.number(),
    medianEvEbitda: z.number(),
    medianPremium: z.number(),
  }),
});

export const competitiveLandscapeSchema = z.object({
  marketStructure: stringCellSchema,
  competitors: z.array(z.object({
    name: z.string(),
    marketSharePct: numericCellSchema,
    positioning: z.string(),
  })),
  positioningMapData: z.array(z.object({
    name: z.string(),
    xAxis: z.number(),
    yAxis: z.number(),
    bubbleSize: z.number(),
  })),
});

export const valuationOutputSchema = z.object({
  footballField: z.object({
    ranges: z.array(z.object({
      method: z.string(),
      low: z.number(),
      mid: z.number(),
      high: z.number(),
    })),
    overallLow: z.number(),
    overallHigh: z.number(),
  }),
  dcfAssumptions: z.object({
    waccLow: z.number(),
    waccBase: z.number(),
    waccHigh: z.number(),
    terminalGrowth: z.number(),
    forecastYears: z.number(),
    notes: z.string(),
  }),
});

export const recommendationOutputSchema = z.object({
  rankedAcquirers: z.array(z.object({
    rank: z.number(),
    acquirer: z.string(),
    overallScore: z.number(),
    rationale: z.string(),
  })).length(8),
  recommendedCounterparty: z.string(),
  rationale: stringCellSchema,
  dissentingViews: z.array(z.object({
    persona: z.string(),
    concern: z.string(),
  })),
});
