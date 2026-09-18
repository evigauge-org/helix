// lib/agents/tools/ib/sec_edgar/sec_edgar_xbrl_facts.ts
import { z } from "zod";
import type { ToolDef } from "@/lib/agents/types";
import { getJson, padCik } from "./client";

const schema = z.object({
  cik: z.string().min(1),
  concepts: z.array(z.string()).optional(), // e.g. ["us-gaap:Revenues", "us-gaap:NetIncomeLoss"]
});

type CompanyFacts = {
  cik: number;
  entityName: string;
  facts: Record<string, Record<string, {
    label?: string;
    description?: string;
    units: Record<string, Array<{
      end: string; val: number; fy: number; fp: string; form: string; accn: string;
    }>>;
  }>>;
};

const DEFAULT_CONCEPTS = [
  "Revenues",
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "OperatingIncomeLoss",
  "NetIncomeLoss",
  "EarningsPerShareBasic",
  "Assets",
  "Liabilities",
  "StockholdersEquity",
  "CashAndCashEquivalentsAtCarryingValue",
  "LongTermDebtNoncurrent",
];

export const secEdgarXbrlFactsTool: ToolDef<typeof schema> = {
  slug: "sec_edgar_xbrl_facts",
  description:
    "Pull structured XBRL facts (revenue, EBITDA components, net income, balance sheet items) for a company. " +
    "Returns annual + quarterly series with reporting dates.",
  schema,
  execute: async (_ctx, args) => {
    try {
      const cik = padCik(args.cik);
      const data = await getJson<CompanyFacts>(
        `/api/xbrl/companyfacts/CIK${cik}.json`,
        `sec:xbrl:${cik}`,
      );
      const wantConcepts = args.concepts ?? DEFAULT_CONCEPTS.map((c) => `us-gaap:${c}`);
      const out: Record<string, unknown> = { entityName: data.entityName, cik };
      for (const concept of wantConcepts) {
        const [taxonomy, name] = concept.includes(":") ? concept.split(":") : ["us-gaap", concept];
        const node = data.facts?.[taxonomy]?.[name];
        if (!node) continue;
        // Pick USD if available, else first unit
        const unitKey = Object.keys(node.units).find((k) => k === "USD") ?? Object.keys(node.units)[0];
        if (!unitKey) continue;
        out[name] = {
          unit: unitKey,
          values: node.units[unitKey]
            .filter((v) => v.form === "10-K" || v.form === "10-Q")
            .slice(-20),
        };
      }
      return { ok: true, data: out };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
