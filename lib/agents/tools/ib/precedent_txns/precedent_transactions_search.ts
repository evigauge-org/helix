// lib/agents/tools/ib/precedent_txns/precedent_transactions_search.ts
import { z } from "zod";
import type { ToolDef } from "@/lib/agents/types";
import { searchSecMergers, type PrecedentCandidate } from "./search";

const schema = z.object({
  sectorKeywords: z.array(z.string()).min(1).max(10),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minEnterpriseValueUsd: z.number().nonnegative().optional(),
  maxEnterpriseValueUsd: z.number().nonnegative().optional(),
  top: z.number().int().min(1).max(100).default(30),
});

export const precedentTransactionsSearchTool: ToolDef<typeof schema> = {
  slug: "precedent_transactions_search",
  description:
    "Find candidate precedent M&A deals from SEC EDGAR (S-4 / DEFM14A / 8-K) for a sector + date range. " +
    "Returns deal candidates that the agent should then enrich via precedent_transaction_extract.",
  schema,
  execute: async (_ctx, args) => {
    try {
      const sec = await searchSecMergers({
        fromDate: args.fromDate,
        toDate: args.toDate,
      });
      // Filter by sector keywords presence in acquirer/target name (cheap pre-filter)
      const lc = args.sectorKeywords.map((k) => k.toLowerCase());
      const filtered: PrecedentCandidate[] = sec.filter((c) =>
        lc.some((kw) => c.acquirer.toLowerCase().includes(kw)),
      );
      return { ok: true, data: { candidates: filtered.slice(0, args.top) } };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
