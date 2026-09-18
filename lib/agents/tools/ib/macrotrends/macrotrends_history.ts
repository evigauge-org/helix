// lib/agents/tools/ib/macrotrends/macrotrends_history.ts
import { z } from "zod";
import type { ToolDef } from "@/lib/agents/types";
import { scrapeMacrotrendsMetric } from "./scraper";

const KNOWN_METRICS = [
  "revenue", "gross-profit", "operating-income", "net-income",
  "ebit", "ebitda", "total-assets", "total-debt",
  "cash-on-hand", "free-cash-flow",
] as const;

const schema = z.object({
  ticker: z.string().min(1).max(10),
  companySlug: z.string().min(1).max(60), // macrotrends URL slug, e.g. "apple"
  metric: z.enum(KNOWN_METRICS),
});

export const macrotrendsHistoryTool: ToolDef<typeof schema> = {
  slug: "macrotrends_history",
  description:
    "10-20 year historical financial series from Macrotrends. Use for trend charts and CAGR analysis.",
  schema,
  execute: async (_ctx, args) => {
    try {
      const { rows, sourceUrl } = await scrapeMacrotrendsMetric(args.ticker, args.companySlug, args.metric);
      return { ok: true, data: { ticker: args.ticker, metric: args.metric, rows, sourceUrl } };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
