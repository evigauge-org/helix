// lib/agents/tools/india_gov/dataset_fetch.ts
import { z } from "zod";
import type { ToolDef } from "@/lib/agents/types";
import { dataGovInClient } from "./shared/client";

const schema = z.object({
  resourceId: z.string().min(1).max(120),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
  filters: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  fields: z.array(z.string()).optional(),
});

export const dataGovInDatasetFetchTool: ToolDef<typeof schema> = {
  slug: "data_gov_in_dataset_fetch",
  description:
    "Fetch records from a data.gov.in resource by resourceId. Pass filters as { columnName: value } to narrow results. " +
    "Returns { records, totalCount, fields, sourceUrl, visualizeUrl, accessedAt, publisherLastUpdate, cacheHit }. " +
    "Use a curated tool first if available (rbi_policy_rates, mospi_cpi, etc.); use this for long-tail datasets.",
  schema,
  execute: async (ctx, args) => {
    const result = await dataGovInClient.fetchResource({
      userId: ctx.userId,
      resourceId: args.resourceId,
      limit: args.limit,
      offset: args.offset,
      filters: args.filters,
      fields: args.fields,
    });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return { ok: true, data: result.data };
  },
};
