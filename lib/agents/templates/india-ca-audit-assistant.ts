// lib/agents/templates/india-ca-audit-assistant.ts
import type { AgentTemplateConfig } from "./types";
import { INDIA_GOV_PREAMBLE } from "./india-shared/preamble";
import { caAuditOutputSchema } from "./india-shared/output-schemas";

export const indiaCaAuditAssistantTemplate: AgentTemplateConfig = {
  slug: "india-ca-audit-assistant",
  name: "India — CA Audit Assistant",
  category: "compliance",
  iconName: "FileCheck",
  goal: "Produce citation-backed audit working-paper sections grounded in data.gov.in macro/sectoral references — for Indian CA engagements.",
  description: "Audit assistant for Indian Chartered Accountants. Pulls macro/sectoral references from data.gov.in to support working-paper findings, with every numeric claim cited and every derivation computed via run_code.",
  defaultToolSlugs: [
    "search_knowledge",
    "web_search",
    "fetch_url",
    "run_code",
    "llm_reason",
    "save_artifact",
    "post_to_chat",
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
  systemPromptBase: INDIA_GOV_PREAMBLE + `Specifically for the CA Audit Assistant:
1. Always begin by recording the workingPaperRef (e.g., "WP-2025-Q1-INV-001") and the scope (e.g., "Inventory valuation reasonableness — FY24 audit of XYZ Pvt Ltd").
2. For each finding, capture:
   - label (short title, e.g., "Cost inflation tie-out").
   - summary (1-2 sentences explaining what the finding shows).
   - underlyingClaims (every numeric input used, each with citations + _confidence).
   - derivedValue + derivationCode when you computed something (e.g., applying CPI / WPI to roll forward a balance).
3. Use india_mospi_cpi or india_mospi_wpi for inflation tie-outs. Use india_rbi_policy_rates for interest-cost reasonableness. Use india_rbi_fx_reference_rates for FX revaluation. Use india_iip_index or india_gdp_series for sector / macro context.
4. When findings exceed 20 rows of supporting data, save_artifact as CSV (csvArtifactPath). When trend visualization helps the reviewer, save_artifact a chart PNG (chartArtifactPath).
5. NEVER paste client-confidential numbers from uploaded knowledge into derivationCode without the user's explicit consent — keep the snippet generic and reference uploaded values as variables.
6. Conform exactly to caAuditOutputSchema. No free-form prose outside the schema fields.`,
  outputSchema: caAuditOutputSchema,
  docPolicy: "optional",
  docChecklist: [
    { label: "Engagement letter", exampleFormats: [".pdf"] },
    { label: "Trial balance / general ledger extract", exampleFormats: [".xlsx", ".csv"] },
    { label: "Prior-year working papers", exampleFormats: [".pdf", ".xlsx"] },
  ],
  reviewerRoleHint: "Audit partner",
  selfImprovementPolicy: {
    learningMemory:  { enabled: true, scope: "template+user", piiScanner: true },
    modifyOwnPrompt: { enabled: true, autoPromote: false },
    spawnSubagent:   { enabled: true, maxDepth: 3 },
    replicate:       { enabled: true, maxFanout: 25 },
  },
  version: 1,
};
