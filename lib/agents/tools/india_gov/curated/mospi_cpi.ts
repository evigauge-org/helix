// lib/agents/tools/india_gov/curated/mospi_cpi.ts
import { z } from "zod";
import type { ToolDef } from "@/lib/agents/types";
import { dataGovInClient } from "../shared/client";

const RESOURCE_ID = "REPLACE_WITH_RESOLVED_RESOURCE_ID";

const schema = z.object({
  region: z.string().default("All India"),
  category: z.enum(["All", "Food", "Non-Food", "Fuel"]).default("All"),
  fromMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  toMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  top: z.number().int().min(1).max(500).default(36),
});

export const indiaMospiCpiTool: ToolDef<typeof schema> = {
  slug: "india_mospi_cpi",
  description:
    "Consumer Price Index (CPI) — All India + state-wise, monthly. Filter by region (e.g., 'All India', 'Maharashtra') and category (All/Food/Non-Food/Fuel). " +
    "Source: MoSPI via data.gov.in. Use for inflation-driven valuation assumptions.",
  schema,
  execute: async (ctx, args) => {
    const filters: Record<string, string> = { region: args.region, category: args.category };
    if (args.fromMonth) filters["month_from"] = args.fromMonth;
    if (args.toMonth) filters["month_to"] = args.toMonth;
    const result = await dataGovInClient.fetchResource({
      userId: ctx.userId,
      resourceId: RESOURCE_ID,
      limit: args.top,
      filters,
    });
    if (!result.ok) {
      return {
        ok: false,
        error: `${result.error}. If this dataset has been republished, use data_gov_in_catalog_search with q="Consumer Price Index" to find the new resourceId.`,
      };
    }
    return { ok: true, data: result.data };
  },
};
