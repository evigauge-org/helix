// lib/agents/templates/india-cfo-insight-assistant.ts
import type { AgentTemplateConfig } from "./types";
import { INDIA_GOV_PREAMBLE } from "./india-shared/preamble";
import { cfoInsightOutputSchema } from "./india-shared/output-schemas";

export const indiaCfoInsightAssistantTemplate: AgentTemplateConfig = {
  slug: "india-cfo-insight-assistant",
  name: "India — CFO Insight Assistant",
  category: "finance-ops",
  iconName: "TrendingUp",
  goal: "Produce citation-backed macro/sectoral insight briefs sourced from data.gov.in — for Indian CFO / FP&A board decks and MIS reviews.",
  description: "CFO / FP&A insight assistant for Indian finance leaders. Synthesizes data.gov.in macro and sectoral indicators (CPI, WPI, GDP, IIP, RBI rates, FX, SEBI AUM) into board-ready narratives with charts, CSVs, and DOCX exports — every numeric claim cited.",
  defaultToolSlugs: [
    "search_knowledge",
    "web_search",
    "fetch_url",
    "run_code",
    "llm_reason",
    "save_artifact",
    "post_to_chat",
    "create_docx",
    "create_enterprise_report",
    "data_gov_in_catalog_search",
    "data_gov_in_dataset_fetch",
    "india_rbi_policy_rates",
    "india_rbi_fx_reference_rates",
    "india_mospi_cpi",
    "india_mospi_wpi",
    "india_sebi_mutual_fund_aum",
    "india_gdp_series",
    "india_iip_index",
  ],
  systemPromptBase: INDIA_GOV_PREAMBLE + `Specifically for the CFO Insight Assistant:
1. Always begin by recording the topic (e.g., "FY25 input-cost outlook for an Indian auto-component CFO") and a 2-4 sentence narrative anchored to the data.
2. trendClaims must capture every numeric backbone of the narrative — each with citations and _confidence. Prefer YoY % deltas, multi-year CAGRs, and rolling averages computed via run_code.
3. When a chart helps the board, populate chartSpec (chartType, xField, yFields, title) AND save_artifact a PNG to artifactPaths.chartPath. Stacked bars only when the y-axis decomposes a single total.
4. When the supporting tabular data exceeds 20 rows, save_artifact a CSV to artifactPaths.csvPath.
5. When the user wants a board-ready brief, use create_docx (or create_enterprise_report for longer reports) and surface the path in artifactPaths.docxPath. Cite every figure inline.
6. Recommendations are optional — only emit when the data supports a clear, defensible action. Never hand out advice grounded in interpolation or uncited assumptions.
7. Conform exactly to cfoInsightOutputSchema. No free-form prose outside the schema fields.`,
  outputSchema: cfoInsightOutputSchema,
  docPolicy: "optional",
  docChecklist: [
    { label: "Latest board deck (template)", exampleFormats: [".pptx", ".pdf"] },
    { label: "MIS template / KPI sheet", exampleFormats: [".xlsx", ".csv"] },
  ],
  reviewerRoleHint: "CFO / FP&A lead",
  selfImprovementPolicy: {
    learningMemory:  { enabled: true, scope: "template+user", piiScanner: false },
    modifyOwnPrompt: { enabled: true, autoPromote: false },
    spawnSubagent:   { enabled: true, maxDepth: 3 },
    replicate:       { enabled: true, maxFanout: 25 },
  },
  version: 1,
};
