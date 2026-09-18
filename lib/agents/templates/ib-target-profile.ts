// lib/agents/templates/ib-target-profile.ts
import type { AgentTemplateConfig } from "./types";
import { IB_SUBAGENT_PREAMBLE } from "./ib-shared/preamble";
import { targetProfileSchema } from "./ib-shared/output-schemas";

export const ibTargetProfileTemplate: AgentTemplateConfig = {
  slug: "ib-target-profile",
  name: "IB — Target Profile",
  category: "research",
  iconName: "Building",
  goal: "Produce a citation-backed target profile section for a pitch book — financials, segments, ownership, key drivers.",
  description: "Sub-agent of the IB Pitch Book Orchestrator. Produces ONE section of the deck.",
  defaultToolSlugs: [
    "search_knowledge",
    "web_search",
    "fetch_url",
    "sec_edgar_company_search",
    "sec_edgar_filings",
    "sec_edgar_xbrl_facts",
    "screener_company",
    "yahoo_finance_quote",
    "yahoo_finance_financials",
    "run_code",
    "llm_reason",
  ],
  systemPromptBase: IB_SUBAGENT_PREAMBLE + `Specifically for Target Profile:
1. Disambiguate the target — use sec_edgar_company_search for US listcos or screener_company for Indian listcos.
2. Pull last 3 years of revenue, EBITDA, net income from sec_edgar_xbrl_facts (US) or screener_company (India).
3. Pull current market cap + EV from yahoo_finance_quote.
4. Compute margins via run_code (gross, operating). Cite the underlying revenue + cogs / opex numbers.
5. Identify segments from the latest 10-K (US) or annual report (uploads). One sentence per segment, with revenue.
6. Pull top-5 holders from the latest 13F or proxy. Mark "Not disclosed" if not available.
7. Surface 3-5 key drivers from the latest 10-K MD&A or earnings call transcript (uploaded knowledge).`,
  outputSchema: targetProfileSchema,
  docPolicy: "optional",
  docChecklist: [
    { label: "10-K / annual report", exampleFormats: [".pdf"] },
    { label: "Latest earnings call transcript", exampleFormats: [".pdf", ".txt"] },
    { label: "CIM (if seller-side)", exampleFormats: [".pdf"] },
  ],
  reviewerRoleHint: "M&A analyst",
  selfImprovementPolicy: {
    learningMemory:  { enabled: true, scope: "template+user", piiScanner: true },
    modifyOwnPrompt: { enabled: true, autoPromote: false },
    spawnSubagent:   { enabled: true, maxDepth: 3 },
    replicate:       { enabled: true, maxFanout: 25 },
  },
  version: 1,
};
