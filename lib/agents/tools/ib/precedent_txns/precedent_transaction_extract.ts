// lib/agents/tools/ib/precedent_txns/precedent_transaction_extract.ts
import { z } from "zod";
import type { ToolDef } from "@/lib/agents/types";
import { extractDealTermsFromUrl } from "./extract";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  url: z.string().url(),
  cacheToDb: z.boolean().default(true),
});

export const precedentTransactionExtractTool: ToolDef<typeof schema> = {
  slug: "precedent_transaction_extract",
  description:
    "Given an SEC filing URL or press release URL, extract structured deal terms (acquirer, target, EV, multiples, premium, structure). " +
    "Deterministic regex extraction — agent should LLM-confirm before relying on the values.",
  schema,
  execute: async (_ctx, args) => {
    try {
      const deal = await extractDealTermsFromUrl(args.url);
      if (args.cacheToDb && deal.acquirer && deal.target && deal.announceDate) {
        await prisma.precedentTransactionCache.create({
          data: {
            acquirerName: deal.acquirer,
            targetName: deal.target,
            announceDate: new Date(deal.announceDate),
            enterpriseValue: deal.enterpriseValueUsd ?? null,
            evRevenueMultiple: deal.evRevenueMultiple ?? null,
            evEbitdaMultiple: deal.evEbitdaMultiple ?? null,
            premiumPct: deal.premiumPct ?? null,
            structure: deal.structure ?? null,
            sectors: [],
            sourceUrls: [args.url],
          },
        });
      }
      return { ok: true, data: deal };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
