// lib/agents/tools/ib/yahoo/yahoo_finance_quote.ts
import { z } from "zod";
import type { ToolDef } from "@/lib/agents/types";
import { quote, quoteSummary } from "./client";

const schema = z.object({ symbol: z.string().min(1).max(20) });

type QuoteResp = {
  quoteResponse?: { result?: Array<Record<string, unknown>> };
};
type SummaryResp = {
  quoteSummary?: { result?: Array<Record<string, unknown>> };
};

export const yahooFinanceQuoteTool: ToolDef<typeof schema> = {
  slug: "yahoo_finance_quote",
  description:
    "Current price + market cap + EV + valuation multiples (P/E, EV/EBITDA, EV/Revenue) for a public symbol.",
  schema,
  execute: async (_ctx, args) => {
    try {
      const [q, s] = await Promise.all([
        quote<QuoteResp>(args.symbol),
        quoteSummary<SummaryResp>(args.symbol, ["price", "summaryDetail", "defaultKeyStatistics", "financialData"]),
      ]);
      const qr = q.quoteResponse?.result?.[0] ?? {};
      const sr = s.quoteSummary?.result?.[0] ?? {};
      return {
        ok: true,
        data: {
          symbol: args.symbol,
          price: qr.regularMarketPrice ?? null,
          marketCap: qr.marketCap ?? null,
          enterpriseValue: (sr.defaultKeyStatistics as { enterpriseValue?: { raw: number } } | undefined)?.enterpriseValue?.raw ?? null,
          peRatio: qr.trailingPE ?? null,
          evToEbitda: (sr.defaultKeyStatistics as { enterpriseToEbitda?: { raw: number } } | undefined)?.enterpriseToEbitda?.raw ?? null,
          evToRevenue: (sr.defaultKeyStatistics as { enterpriseToRevenue?: { raw: number } } | undefined)?.enterpriseToRevenue?.raw ?? null,
          currency: qr.currency ?? null,
          source: `https://finance.yahoo.com/quote/${args.symbol}`,
        },
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
