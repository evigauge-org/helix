// lib/agents/tools/ib/valuation/acquirer_capacity_score.ts
import { z } from "zod";
import type { ToolDef } from "@/lib/agents/types";
import { scoreAcquirerCapacity } from "./capacity_score";

const schema = z.object({
  acquirer: z.object({
    marketCap: z.number(),
    cashOnHand: z.number(),
    longTermDebt: z.number(),
    netDebt: z.number(),
    leverageDebtToEbitda: z.number(),
  }),
  targetEv: z.number(),
  acquirerEbitda: z.number(),
  maxLeverageDebtToEbitda: z.number().optional(),
});

export const acquirerCapacityScoreTool: ToolDef<typeof schema> = {
  slug: "acquirer_capacity_score",
  description:
    "Score an acquirer's financial capacity to do the deal (cash on hand, debt headroom, relative size) on a 0-100 scale with rationale.",
  schema,
  execute: async (_ctx, args) => {
    try {
      const result = scoreAcquirerCapacity(args);
      return { ok: true, data: result };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
