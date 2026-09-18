// lib/agents/tools/india_gov/curated/sebi_mutual_fund_aum.ts
import { z } from "zod";
import type { ToolDef } from "@/lib/agents/types";
import { dataGovInClient } from "../shared/client";

const RESOURCE_ID = "REPLACE_WITH_RESOLVED_RESOURCE_ID";

const schema = z.object({
  amcName: z.string().optional(),
  schemeType: z.string().optional(),
  asOfMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  top: z.number().int().min(1).max(500).default(50),
});

export const indiaSebiMutualFundAumTool: ToolDef<typeof schema> = {
  slug: "india_sebi_mutual_fund_aum",
  description:
    "AMC-wise mutual fund AUM (Assets Under Management), monthly. Filter by amcName (e.g., 'HDFC Mutual Fund'), schemeType (e.g., 'Equity', 'Debt'), or asOfMonth. " +
    "Source: SEBI / AMFI via data.gov.in. Use for AMC benchmarking and MF-related audit working papers.",
  schema,
  execute: async (ctx, args) => {
    const filters: Record<string, string> = {};
    if (args.amcName) filters["amc_name"] = args.amcName;
    if (args.schemeType) filters["scheme_type"] = args.schemeType;
    if (args.asOfMonth) filters["month"] = args.asOfMonth;
    const result = await dataGovInClient.fetchResource({
      userId: ctx.userId,
      resourceId: RESOURCE_ID,
      limit: args.top,
      filters,
    });
    if (!result.ok) {
      return {
        ok: false,
        error: `${result.error}. If this dataset has been republished, use data_gov_in_catalog_search with q="Mutual Fund Assets Under Management" to find the new resourceId.`,
      };
    }
    return { ok: true, data: result.data };
  },
};
