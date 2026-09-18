// lib/agents/tools/india_gov/curated/rbi_policy_rates.ts
import { z } from "zod";
import type { ToolDef } from "@/lib/agents/types";
import { dataGovInClient } from "../shared/client";

// VERIFY this against `data_gov_in_catalog_search` for "Key Policy Rates of RBI".
// data.gov.in occasionally republishes; if 404, fall back to catalog_search.
const RESOURCE_ID = "REPLACE_WITH_RESOLVED_RESOURCE_ID";

const schema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  top: z.number().int().min(1).max(500).default(60),
});

export const indiaRbiPolicyRatesTool: ToolDef<typeof schema> = {
  slug: "india_rbi_policy_rates",
  description:
    "Historical RBI policy rates — repo, reverse repo, MSF, bank rate, CRR, SLR — keyed by effective date. " +
    "Source: Reserve Bank of India via data.gov.in. Use for audit-assumption rate inputs and rate-cycle commentary.",
  schema,
  execute: async (ctx, args) => {
    const filters: Record<string, string> = {};
    if (args.fromDate) filters["effective_date_from"] = args.fromDate;
    if (args.toDate) filters["effective_date_to"] = args.toDate;
    const result = await dataGovInClient.fetchResource({
      userId: ctx.userId,
      resourceId: RESOURCE_ID,
      limit: args.top,
      filters,
    });
    if (!result.ok) {
      return {
        ok: false,
        error: `${result.error}. If this dataset has been republished, use data_gov_in_catalog_search with q="Key Policy Rates of RBI" to find the new resourceId.`,
      };
    }
    return { ok: true, data: result.data };
  },
};
