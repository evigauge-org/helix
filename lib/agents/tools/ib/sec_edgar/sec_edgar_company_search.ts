// lib/agents/tools/ib/sec_edgar/sec_edgar_company_search.ts
import { z } from "zod";
import type { ToolDef } from "@/lib/agents/types";
import { getJson } from "./client";

const schema = z.object({
  query: z.string().min(1).max(120),
  top: z.number().int().min(1).max(20).default(5),
});

type EdgarCompanyTickers = Record<string, { cik_str: number; ticker: string; title: string }>;

export const secEdgarCompanySearchTool: ToolDef<typeof schema> = {
  slug: "sec_edgar_company_search",
  description:
    "Look up a company on SEC EDGAR by ticker or name. Returns CIK + ticker + title for the top matches. " +
    "Use this first to disambiguate a company before calling sec_edgar_filings.",
  schema,
  execute: async (_ctx, args) => {
    try {
      const tickers = await getJson<EdgarCompanyTickers>(
        "https://www.sec.gov/files/company_tickers.json",
        "sec:company_tickers",
      );
      const q = args.query.toLowerCase();
      const matches = Object.values(tickers)
        .filter((t) => t.ticker.toLowerCase() === q || t.title.toLowerCase().includes(q))
        .slice(0, args.top)
        .map((t) => ({ cik: String(t.cik_str).padStart(10, "0"), ticker: t.ticker, title: t.title }));
      return { ok: true, data: { matches } };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
