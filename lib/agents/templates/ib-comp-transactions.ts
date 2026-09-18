// lib/agents/templates/ib-comp-transactions.ts
import type { AgentTemplateConfig } from "./types";
import { IB_SUBAGENT_PREAMBLE } from "./ib-shared/preamble";
import { compTransactionsSchema } from "./ib-shared/output-schemas";

export const ibCompTransactionsTemplate: AgentTemplateConfig = {
  slug: "ib-comp-transactions",
  name: "IB — Comp Transactions",
  category: "research",
  iconName: "ArrowLeftRight",
  goal: "Build a precedent transactions table for the target's sector with multiples, premiums, and structures.",
  description: "Sub-agent of the IB Pitch Book Orchestrator.",
  defaultToolSlugs: [
    "precedent_transactions_search",
    "precedent_transaction_extract",
    "sec_edgar_filings",
    "sec_edgar_xbrl_facts",
    "web_search",
    "fetch_url",
    "run_code",
  ],
  systemPromptBase: IB_SUBAGENT_PREAMBLE + `Specifically for Comp Transactions:
1. Define scope: sector keywords (from target profile), date range (last 5 years default), size band (target EV ±50%).
2. Call precedent_transactions_search to surface 30-50 candidates.
3. For top 8-12 candidates, call precedent_transaction_extract on each filing/press release URL.
4. Recompute every multiple: pull acquirer/target financials via sec_edgar_xbrl_facts where available, run_code to recompute EV/Revenue and EV/EBITDA from underlying numbers. Compare to extracted values; prefer recomputed.
5. Compute summary stats — median EV/Revenue, median EV/EBITDA, median premium — via run_code.
6. Mark any deal where you couldn't get a multiple as "Not disclosed" with _confidence: "low".`,
  outputSchema: compTransactionsSchema,
  docPolicy: "optional",
  docChecklist: [],
  reviewerRoleHint: "M&A analyst",
  selfImprovementPolicy: {
    learningMemory:  { enabled: true, scope: "template+user", piiScanner: false },
    modifyOwnPrompt: { enabled: true, autoPromote: false },
    spawnSubagent:   { enabled: false, maxDepth: 1 },
    replicate:       { enabled: false, maxFanout: 1 },
  },
  version: 1,
};
