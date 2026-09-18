// lib/agents/templates/ib-competitive-landscape.ts
import type { AgentTemplateConfig } from "./types";
import { IB_SUBAGENT_PREAMBLE } from "./ib-shared/preamble";
import { competitiveLandscapeSchema } from "./ib-shared/output-schemas";

export const ibCompetitiveLandscapeTemplate: AgentTemplateConfig = {
  slug: "ib-competitive-landscape",
  name: "IB — Competitive Landscape",
  category: "research",
  iconName: "Map",
  goal: "Map the target's competitive landscape — market structure, top competitors, share, positioning.",
  description: "Sub-agent of the IB Pitch Book Orchestrator.",
  defaultToolSlugs: [
    "web_search",
    "search_knowledge",
    "fetch_url",
    "yahoo_finance_quote",
    "macrotrends_history",
    "run_code",
    "llm_reason",
  ],
  systemPromptBase: IB_SUBAGENT_PREAMBLE + `Specifically for Competitive Landscape:
1. Identify the relevant market — use search_knowledge for any industry reports the user uploaded; use Exa for recent analyst notes.
2. Surface top 5-7 competitors with cited share data (annual report disclosures, sell-side notes, news).
3. Build positioning map data — pick two axes that matter for this sector (e.g. price vs. quality, scale vs. specialization). Place each competitor with x/y coordinates.
4. For positioning map bubble sizes, use yahoo_finance_quote to fetch market cap.
5. Mark unknown share figures as "Not disclosed" with _confidence: "low" — DO NOT estimate.`,
  outputSchema: competitiveLandscapeSchema,
  docPolicy: "optional",
  docChecklist: [
    { label: "Industry / sector report", exampleFormats: [".pdf"] },
  ],
  reviewerRoleHint: "M&A analyst",
  selfImprovementPolicy: {
    learningMemory:  { enabled: true, scope: "template+user", piiScanner: false },
    modifyOwnPrompt: { enabled: true, autoPromote: false },
    spawnSubagent:   { enabled: false, maxDepth: 1 },
    replicate:       { enabled: false, maxFanout: 1 },
  },
  version: 1,
};
