// lib/agents/tools/india_gov/curated/mospi_wpi.ts
import { z } from "zod";
import type { ToolDef } from "@/lib/agents/types";
import { dataGovInClient } from "../shared/client";

const RESOURCE_ID = "REPLACE_WITH_RESOLVED_RESOURCE_ID";

const schema = z.object({
  commodityGroup: z.string().optional(),
  fromMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  toMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  top: z.number().int().min(1).max(500).default(36),
});

export const indiaMospiWpiTool: ToolDef<typeof schema> = {
  slug: "india_mospi_wpi",
  description:
    "Wholesale Price Index (WPI) — monthly, by commodity group. Pass commodityGroup to filter (e.g., 'Manufactured Products', 'Primary Articles', 'Fuel & Power'); leave blank for all. " +
    "Source: Office of the Economic Adviser via data.gov.in. Use for sector cost analysis.",
  schema,
  execute: async (ctx, args) => {
    const filters: Record<string, string> = {};
    if (args.commodityGroup) filters["commodity_group"] = args.commodityGroup;
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
        error: `${result.error}. If this dataset has been republished, use data_gov_in_catalog_search with q="Wholesale Price Index" to find the new resourceId.`,
      };
    }
    return { ok: true, data: result.data };
  },
};
