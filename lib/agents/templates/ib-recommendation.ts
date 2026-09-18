// lib/agents/templates/ib-recommendation.ts
import type { AgentTemplateConfig } from "./types";
import { IB_SUBAGENT_PREAMBLE } from "./ib-shared/preamble";
import { recommendationOutputSchema } from "./ib-shared/output-schemas";

export const ibRecommendationTemplate: AgentTemplateConfig = {
  slug: "ib-recommendation",
  name: "IB — Recommendation",
  category: "research",
  iconName: "ThumbsUp",
  goal: "Rank the 8 acquirers and recommend the optimal counterparty with cross-LLM debate.",
  description: "Sub-agent of the IB Pitch Book Orchestrator. Uses llm_debate as a mandatory cross-check.",
  defaultToolSlugs: [
    "llm_debate",
    "search_knowledge",
    "web_search",
    "run_code",
    "llm_reason",
  ],
  systemPromptBase: IB_SUBAGENT_PREAMBLE + `Specifically for Recommendation:
1. Receive (in input): target profile, all 8 acquirer deep-dives, comp txns, valuation, competitive landscape.
2. Build a strategic-fit matrix scoring each acquirer on 5 dimensions (sector overlap, geography, size capacity, prior M&A pattern, deal-structure fit). Use run_code for the matrix math.
3. Compute overallScore per acquirer (weighted average; weights default 0.25/0.15/0.20/0.20/0.20). Rank 1-8.
4. Identify the top recommended counterparty.
5. MANDATORY: call llm_debate with personas ["compliance officer", "skeptic", "sector specialist"] and the question "Should we recommend X as the optimal counterparty for Y? List risks and supporting evidence."
6. Block your output unless ≥2 personas approve. If <2 approve, recommend the next-ranked acquirer and re-debate.
7. Output the ranked list, the recommendation, the cited rationale, and the dissenting views (one per persona that didn't approve).`,
  outputSchema: recommendationOutputSchema,
  docPolicy: "optional",
  docChecklist: [],
  reviewerRoleHint: "Senior M&A banker",
  selfImprovementPolicy: {
    learningMemory:  { enabled: true, scope: "template+user", piiScanner: false },
    modifyOwnPrompt: { enabled: true, autoPromote: false },
    spawnSubagent:   { enabled: false, maxDepth: 1 },
    replicate:       { enabled: false, maxFanout: 1 },
  },
  version: 1,
};
