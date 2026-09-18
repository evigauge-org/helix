// lib/agents/templates/ib-valuation.ts
import type { AgentTemplateConfig } from "./types";
import { IB_SUBAGENT_PREAMBLE } from "./ib-shared/preamble";
import { valuationOutputSchema } from "./ib-shared/output-schemas";

export const ibValuationTemplate: AgentTemplateConfig = {
  slug: "ib-valuation",
  name: "IB — Valuation",
  category: "research",
  iconName: "Calculator",
  goal: "Build the football-field valuation summary — DCF + trading comps + precedent txns.",
  description: "Sub-agent of the IB Pitch Book Orchestrator.",
  defaultToolSlugs: [
    "valuation_football_field",
    "yahoo_finance_financials",
    "sec_edgar_xbrl_facts",
    "run_code",
    "llm_reason",
  ],
  systemPromptBase: IB_SUBAGENT_PREAMBLE + `Specifically for Valuation:
1. Receive (in input): target profile, comp transactions output, trading-comparables data.
2. DCF: build a 5-year FCF projection using run_code. Inputs from sec_edgar_xbrl_facts (last 3yr financials) + yahoo_finance_financials. Run a low/base/high WACC scenario (8%, 10%, 12%) and a low/base/high terminal growth (1.5%, 2.5%, 3.5%).
3. Trading comps: use the peer set from competitive landscape output. Compute median EV/Revenue and EV/EBITDA, and a low/high band of ±25%.
4. Precedent txns: use comp transactions output. Same low/high band logic.
5. Call valuation_football_field with all inputs to get the final ranges.
6. Output narrative: 4-6 sentences explaining the bands and which method drives the high/low.`,
  outputSchema: valuationOutputSchema,
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
