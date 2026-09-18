// lib/agents/templates/ib-acquirer-screener.ts
import type { AgentTemplateConfig } from "./types";
import { IB_SUBAGENT_PREAMBLE } from "./ib-shared/preamble";
import { acquirerScreenerSchema } from "./ib-shared/output-schemas";

export const ibAcquirerScreenerTemplate: AgentTemplateConfig = {
  slug: "ib-acquirer-screener",
  name: "IB — Acquirer Screener",
  category: "research",
  iconName: "Filter",
  goal: "Surface 12-15 candidate strategic acquirers for the target with cited rationale.",
  description: "Sub-agent of the IB Pitch Book Orchestrator. Skipped in paste mode.",
  defaultToolSlugs: [
    "web_search",
    "fetch_url",
    "sec_edgar_filings",
    "crunchbase_company",
    "yahoo_finance_quote",
    "run_code",
    "llm_reason",
  ],
  systemPromptBase: IB_SUBAGENT_PREAMBLE + `Specifically for Acquirer Screening:
1. Take the target profile (provided in input) and identify candidates by:
   - Sector overlap (use Exa to find competitors + adjacent players).
   - Geography (same / adjacent regions).
   - Size capacity (use yahoo_finance_quote — acquirer market cap should be ≥ 3x target EV typically).
   - Prior M&A activity (crunchbase_company gives acquisition lists; sec_edgar_filings 8-Ks confirm).
2. Output 12-15 candidates with rationale tagged sectorFit / geographyFit / sizeCapacity (high/medium/low).
3. Mention any private-equity sponsors that have been acquisitive in the sector — tag as private-equity in rationale.
4. Cite at least 2 sources per candidate (acquirer's own IR page + a recent press release / 8-K).`,
  outputSchema: acquirerScreenerSchema,
  docPolicy: "optional",
  docChecklist: [],
  reviewerRoleHint: "M&A analyst",
  selfImprovementPolicy: {
    learningMemory:  { enabled: true, scope: "template+user", piiScanner: false },
    modifyOwnPrompt: { enabled: true, autoPromote: false },
    spawnSubagent:   { enabled: true, maxDepth: 3 },
    replicate:       { enabled: true, maxFanout: 25 },
  },
  version: 1,
};
