// lib/agents/tools/india_gov/curated/gdp_series.ts
import { z } from "zod";
import type { ToolDef } from "@/lib/agents/types";
import { dataGovInClient } from "../shared/client";

const RESOURCE_ID = "REPLACE_WITH_RESOLVED_RESOURCE_ID";

const schema = z.object({
  cadence: z.enum(["quarterly", "annual"]).default("annual"),
  basis: z.enum(["constant", "current"]).default("constant"),
  fromYear: z.number().int().min(1990).max(2100).optional(),
  toYear: z.number().int().min(1990).max(2100).optional(),
  sector: z.string().optional(),
  top: z.number().int().min(1).max(200).default(40),
});

export const indiaGdpSeriesTool: ToolDef<typeof schema> = {
  slug: "india_gdp_series",
  description:
    "GDP series — quarterly or annual, at constant or current prices, optionally filtered by sector (e.g., 'Manufacturing', 'Services'). " +
    "Source: MoSPI / National Statistical Office via data.gov.in. Use for macro context in management commentary.",
  schema,
  execute: async (ctx, args) => {
    const filters: Record<string, string | number> = {
      cadence: args.cadence,
      basis: args.basis,
    };
    if (args.fromYear) filters["year_from"] = args.fromYear;
    if (args.toYear) filters["year_to"] = args.toYear;
    if (args.sector) filters["sector"] = args.sector;
    const result = await dataGovInClient.fetchResource({
      userId: ctx.userId,
      resourceId: RESOURCE_ID,
      limit: args.top,
      filters,
    });
    if (!result.ok) {
      return {
        ok: false,
        error: `${result.error}. If this dataset has been republished, use data_gov_in_catalog_search with q="Gross Domestic Product" to find the new resourceId.`,
      };
    }
    return { ok: true, data: result.data };
  },
};
