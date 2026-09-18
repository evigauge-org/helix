// lib/agents/tools/india_gov/catalog_search.ts
import { z } from "zod";
import type { ToolDef } from "@/lib/agents/types";
import { dataGovInClient } from "./shared/client";

const schema = z.object({
  query: z.string().min(1).max(120),
  limit: z.number().int().min(1).max(50).default(10),
});

export const dataGovInCatalogSearchTool: ToolDef<typeof schema> = {
  slug: "data_gov_in_catalog_search",
  description:
    "Search the data.gov.in catalog by keyword. Returns up to N matching resources with resourceId, title, organization, sectors, lastUpdated, and recordCount. " +
    "Use this when you don't already know the resourceId of the dataset you need (the curated tools cover RBI rates, FX, MoSPI CPI/WPI, SEBI MF AUM, GDP, IIP).",
  schema,
  execute: async (ctx, args) => {
    const result = await dataGovInClient.searchCatalog({
      userId: ctx.userId,
      query: args.query,
      limit: args.limit,
    });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return { ok: true, data: { resources: result.data } };
  },
};
