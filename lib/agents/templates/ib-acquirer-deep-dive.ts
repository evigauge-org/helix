// lib/agents/templates/ib-acquirer-deep-dive.ts
import type { AgentTemplateConfig } from "./types";
import { IB_SUBAGENT_PREAMBLE } from "./ib-shared/preamble";
import { acquirerDeepDiveSchema } from "./ib-shared/output-schemas";

export const ibAcquirerDeepDiveTemplate: AgentTemplateConfig = {
  slug: "ib-acquirer-deep-dive",
  name: "IB — Acquirer Deep-Dive",
  category: "research",
  iconName: "Target",
  goal: "Produce a deep-dive on ONE strategic acquirer — financial capacity, prior M&A, strategic fit thesis.",
  description: "Sub-agent of the IB Pitch Book Orchestrator. Replicated 8 times in parallel via replicate({fanout: 8}).",
  defaultToolSlugs: [
    "search_knowledge",
    "web_search",
    "fetch_url",
    "sec_edgar_company_search",
    "sec_edgar_filings",
    "sec_edgar_xbrl_facts",
    "yahoo_finance_quote",
    "yahoo_finance_financials",
    "crunchbase_company",
    "macrotrends_history",
    "acquirer_capacity_score",
    "run_code",
    "llm_reason",
  ],
  systemPromptBase: IB_SUBAGENT_PREAMBLE + `Specifically for Acquirer Deep-Dive (you are deep-diving exactly ONE acquirer; receive the acquirer name + target context as input):
1. Pull the acquirer's financial snapshot — yahoo_finance_quote for current EV/MC, sec_edgar_xbrl_facts for cash + LT debt, run_code to compute leverage ratio.
2. Pull macrotrends_history for revenue + EBITDA trends (last 10 years).
3. Pull crunchbase_company for prior acquisitions; verify each via sec_edgar_filings 8-Ks where available.
4. Call acquirer_capacity_score with computed inputs (target EV from input, acquirer ebitda from XBRL/Yahoo).
5. Strategic fit thesis: 3-5 sentences citing the acquirer's recent strategic priorities (latest 10-K Item 1, latest investor day, latest CEO letter).
6. Deal structure preference: based on prior deals — does this acquirer prefer cash, stock, or mix? Cite at least one prior deal.`,
  outputSchema: acquirerDeepDiveSchema,
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
