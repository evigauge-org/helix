// lib/agents/tools/screener_company.ts
import { z } from "zod";
import { load } from "cheerio";
import type { ToolDef, ToolContext, ToolResult } from "../types";
import { fetchScreenerHtml } from "./screener/client";
import { detectSector } from "./screener/sector";
import { parseOverview } from "./screener/parsers/overview";
import { parseCompany } from "./screener/parsers/company";
import { parseProsCons } from "./screener/parsers/pros-cons";
import { parseQuarterly } from "./screener/parsers/quarterly";
import { parseProfitLoss } from "./screener/parsers/profit-loss";
import { parseBalanceSheet } from "./screener/parsers/balance-sheet";
import { parseCashFlow } from "./screener/parsers/cash-flow";
import { parseRatios } from "./screener/parsers/ratios";
import { parseShareholding } from "./screener/parsers/shareholding";
import { parseGrowth } from "./screener/parsers/growth";
import { parsePeers } from "./screener/parsers/peers";

const schema = z.object({
  ticker: z.string().min(1).max(20),
  segment: z.enum(["standalone", "consolidated"]).default("standalone"),
});

/**
 * Wraps a per-section parser in try/catch. Failures are recorded in
 * the warnings array; the orchestrator keeps the rest of the payload.
 */
function safeParse<T>(label: string, fn: () => T, fallback: T, warnings: string[]): T {
  try { return fn(); }
  catch (e) {
    warnings.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
    return fallback;
  }
}

export const screenerCompanyTool: ToolDef<typeof schema> = {
  slug: "screener_company",
  description:
    "Fetch fundamental data for an Indian-listed company from Screener.in. " +
    "Returns overview ratios, last 5 quarters, 10y P&L + balance sheet + cash flow + ratios, " +
    "shareholding pattern (latest + 8q history), growth CAGRs, pros/cons, and up to 10 peer companies. " +
    "Sector-aware: top-level `sector` field is 'generic' | 'banking' | 'nbfc' and discriminates the " +
    "shape of profitLoss / balanceSheet / quarterly rows. Use NSE symbol (RELIANCE, TCS) or BSE code (500325). " +
    "Defaults to standalone; pass segment:'consolidated' for multi-subsidiary companies.",
  schema,
  // NOT requiresApproval — read-only public market data.
  async execute(_ctx: ToolContext, args: z.infer<typeof schema>): Promise<ToolResult> {
    const fetched = await fetchScreenerHtml({ ticker: args.ticker, segment: args.segment });
    if (!fetched.ok) return { ok: false, error: fetched.error };

    const $ = load(fetched.html);
    const warnings: string[] = [];
    const sector = safeParse("sector", () => detectSector($), "generic" as const, warnings);

    const company = safeParse("company", () => parseCompany($), {
      name: "", bse: null, nse: null, industry: null, website: null, about: null,
    }, warnings);

    const overview = safeParse("overview", () => parseOverview($), {
      marketCap: null, currentPrice: null, high52w: null, low52w: null,
      pe: null, pb: null, bookValue: null, dividendYield: null,
      roce: null, roe: null, faceValue: null,
    }, warnings);

    const { pros, cons } = safeParse("pros-cons", () => parseProsCons($), { pros: [], cons: [] }, warnings);
    const quarterly = safeParse("quarterly", () => parseQuarterly($, sector), [], warnings);
    const profitLoss = safeParse("profit-loss", () => parseProfitLoss($, sector), [], warnings);
    const balanceSheet = safeParse("balance-sheet", () => parseBalanceSheet($, sector), [], warnings);
    const cashFlow = safeParse("cash-flow", () => parseCashFlow($), [], warnings);
    const ratios = safeParse("ratios", () => parseRatios($), [], warnings);
    const shareholding = safeParse("shareholding", () => parseShareholding($), {
      asOf: "", promoters: null, fii: null, dii: null, public: null, government: null, history: [],
    }, warnings);
    const growth = safeParse("growth", () => parseGrowth($), {
      salesCagr:  { "10y": null, "5y": null, "3y": null, ttm: null },
      profitCagr: { "10y": null, "5y": null, "3y": null, ttm: null },
      stockCagr:  { "10y": null, "5y": null, "3y": null, "1y": null },
      roeAvg:     { "10y": null, "5y": null, "3y": null, "1y": null },
    }, warnings);
    const peers = safeParse("peers", () => parsePeers($), [], warnings);

    return {
      ok: true,
      data: {
        ticker: args.ticker.toUpperCase(),
        segment: args.segment,
        sector,
        url: fetched.finalUrl,
        fetchedAt: new Date().toISOString(),
        company,
        overview,
        pros,
        cons,
        quarterly,
        profitLoss,
        balanceSheet,
        cashFlow,
        ratios,
        shareholding,
        growth,
        peers,
        _warnings: warnings,
      },
    };
  },
};
