// lib/agents/tools/india_gov/curated/iip_index.ts
import { z } from "zod";
import type { ToolDef } from "@/lib/agents/types";
import { dataGovInClient } from "../shared/client";

const RESOURCE_ID = "REPLACE_WITH_RESOLVED_RESOURCE_ID";

const schema = z.object({
  sector: z.enum(["Mining", "Manufacturing", "Electricity", "General"]).default("General"),
  fromMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  toMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  top: z.number().int().min(1).max(500).default(36),
});

export const indiaIipIndexTool: ToolDef<typeof schema> = {
  slug: "india_iip_index",
  description:
    "Index of Industrial Production (IIP), monthly. Filter by sector (Mining / Manufacturing / Electricity / General). " +
    "Source: MoSPI via data.gov.in. Use for industrial-sector benchmarking.",
  schema,
  execute: async (ctx, args) => {
    const filters: Record<string, string> = { sector: args.sector };
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
        error: `${result.error}. If this dataset has been republished, use data_gov_in_catalog_search with q="Index of Industrial Production" to find the new resourceId.`,
      };
    }
    return { ok: true, data: result.data };
  },
};
