// lib/agents/tools/ib/crunchbase/crunchbase_company.ts
import { z } from "zod";
import type { ToolDef } from "@/lib/agents/types";
import { scrapeCrunchbase } from "./scraper";

const schema = z.object({
  slug: z.string().min(1).max(80),
});

export const crunchbaseCompanyTool: ToolDef<typeof schema> = {
  slug: "crunchbase_company",
  description:
    "Scrape a Crunchbase organization page (overview, total funding, prior acquisitions). " +
    "Useful for assessing acquirer M&A appetite. May fail on anti-bot blocks — fall back to web_search if so.",
  schema,
  execute: async (_ctx, args) => {
    try {
      const data = await scrapeCrunchbase(args.slug);
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
