// lib/agents/tools/ib/valuation/valuation_football_field.ts
import { z } from "zod";
import type { ToolDef } from "@/lib/agents/types";
import { buildFootballField } from "./football_field";

const schema = z.object({
  targetMetrics: z.object({
    revenue: z.number(),
    ebitda: z.number(),
    netIncome: z.number(),
    currency: z.string().length(3),
  }),
  tradingComps: z.object({
    evRevenueLow: z.number(),
    evRevenueHigh: z.number(),
    evEbitdaLow: z.number(),
    evEbitdaHigh: z.number(),
  }),
  precedentTxns: z.object({
    evRevenueLow: z.number(),
    evRevenueHigh: z.number(),
    evEbitdaLow: z.number(),
    evEbitdaHigh: z.number(),
  }),
  dcfInputs: z.object({
    lowEv: z.number(),
    baseEv: z.number(),
    highEv: z.number(),
  }),
});

export const valuationFootballFieldTool: ToolDef<typeof schema> = {
  slug: "valuation_football_field",
  description:
    "Build a 3-method valuation football field (trading comps, precedent txns, DCF). " +
    "Returns implied EV ranges per method plus the overall low/high envelope.",
  schema,
  execute: async (_ctx, args) => {
    try {
      const result = buildFootballField(args);
      return { ok: true, data: result };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
