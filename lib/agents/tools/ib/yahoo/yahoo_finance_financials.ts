// lib/agents/tools/ib/yahoo/yahoo_finance_financials.ts
import { z } from "zod";
import type { ToolDef } from "@/lib/agents/types";
import { quoteSummary } from "./client";

const schema = z.object({
  symbol: z.string().min(1).max(20),
  cadence: z.enum(["annual", "quarterly"]).default("annual"),
});

type SummaryResp = { quoteSummary?: { result?: Array<Record<string, unknown>> } };

export const yahooFinanceFinancialsTool: ToolDef<typeof schema> = {
  slug: "yahoo_finance_financials",
  description: "Historical income statement / balance sheet / cash flow for a public symbol. Annual or quarterly.",
  schema,
  execute: async (_ctx, args) => {
    try {
      const modules = args.cadence === "annual"
        ? ["incomeStatementHistory", "balanceSheetHistory", "cashflowStatementHistory"]
        : ["incomeStatementHistoryQuarterly", "balanceSheetHistoryQuarterly", "cashflowStatementHistoryQuarterly"];
      const s = await quoteSummary<SummaryResp>(args.symbol, modules);
      const result = s.quoteSummary?.result?.[0] ?? {};
      return {
        ok: true,
        data: {
          symbol: args.symbol,
          cadence: args.cadence,
          ...result,
          source: `https://finance.yahoo.com/quote/${args.symbol}/financials`,
        },
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
