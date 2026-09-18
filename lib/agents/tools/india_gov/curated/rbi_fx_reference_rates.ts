// lib/agents/tools/india_gov/curated/rbi_fx_reference_rates.ts
import { z } from "zod";
import type { ToolDef } from "@/lib/agents/types";
import { dataGovInClient } from "../shared/client";

const RESOURCE_ID = "REPLACE_WITH_RESOLVED_RESOURCE_ID";

const schema = z.object({
  currency: z.enum(["USD", "EUR", "GBP", "JPY"]),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  top: z.number().int().min(1).max(1000).default(90),
});

export const indiaRbiFxReferenceRatesTool: ToolDef<typeof schema> = {
  slug: "india_rbi_fx_reference_rates",
  description:
    "Daily RBI reference exchange rates: USD/EUR/GBP/JPY -> INR. Pick currency to filter; defaults to last 90 calendar days. " +
    "Source: Reserve Bank of India via data.gov.in. Use for forex translation in cross-border audit testing.",
  schema,
  execute: async (ctx, args) => {
    const filters: Record<string, string> = { currency: args.currency };
    if (args.fromDate) filters["date_from"] = args.fromDate;
    if (args.toDate) filters["date_to"] = args.toDate;
    const result = await dataGovInClient.fetchResource({
      userId: ctx.userId,
      resourceId: RESOURCE_ID,
      limit: args.top,
      filters,
    });
    if (!result.ok) {
      return {
        ok: false,
        error: `${result.error}. If this dataset has been republished, use data_gov_in_catalog_search with q="Reference Exchange Rate of Indian Rupee" to find the new resourceId.`,
      };
    }
    return { ok: true, data: result.data };
  },
};
