// lib/agents/templates/india-insurance-factsheet-assistant.ts
import { z } from "zod";
import type { AgentTemplateConfig } from "./types";

const fundRowWithSourceSchema = z.object({
  fundName: z.string(),
  insurer: z.string(),
  monthLabel: z.string(),
  fundType: z.string().nullable(),
  nav: z.number().nullable(),
  aumCr: z.number().nullable(),
  oneMonthReturn: z.number().nullable(),
  threeMonthReturn: z.number().nullable(),
  oneYearReturn: z.number().nullable(),
  threeYearReturn: z.number().nullable(),
  fiveYearReturn: z.number().nullable(),
  sinceInceptionReturn: z.number().nullable(),
  expenseRatioPct: z.number().nullable(),
  benchmarkName: z.string().nullable(),
  sourceCacheId: z.string(),
  sourcePdfUrl: z.string().url(),
  sourcePath: z.enum(["catalog", "fallback"]),
});

export const factsheetAssistantOutputSchema = z.object({
  query: z.string(),
  comparisonRows: z.array(fundRowWithSourceSchema),
  cacheIds: z.array(z.string()),
  warnings: z.array(z.object({
    insurer: z.string(),
    monthLabel: z.string(),
    message: z.string(),
    severity: z.enum(["info", "warning", "error"]),
  })),
  recommendation: z.string().optional(),
});

export const indiaInsuranceFactsheetAssistantTemplate: AgentTemplateConfig = {
  slug: "india-insurance-factsheet-assistant",
  name: "India — Insurance Factsheet Assistant",
  category: "finance-ops",
  iconName: "FileBarChart2",
  goal: "Fetch insurer factsheet PDFs and produce side-by-side fund comparisons with citation-backed data.",
  description: "User-facing assistant that downloads monthly factsheets from Bajaj Allianz Life, Tata AIA, PNB MetLife, HDFC Life, ICICI Prudential, SBI Life, LIC, Max Life (and any other insurer via fallback), extracts fund-level NAV / returns / expense ratio, and posts comparison tables.",
  defaultToolSlugs: [
    "india_insurance_factsheet_fetch",
    "india_insurance_factsheet_extract",
    "web_search",
    "fetch_url",
    "run_code",
    "save_artifact",
    "post_to_chat",
    "llm_reason",
  ],
  systemPromptBase: `You are an insurance factsheet assistant. You fetch monthly factsheet PDFs from
Indian life insurers, extract fund-level data, and produce side-by-side comparisons.

CORE LOOP:
For every fund the user asks about, you MUST:
  1. Call india_insurance_factsheet_fetch(insurer, month?) to get the source PDF.
     - "latest" is the default month if user didn't specify.
     - On error, surface the error message — do NOT fabricate data.
  2. Call india_insurance_factsheet_extract(cacheId) to get FundRow[].
     - If extract returns _confidence: "low", flag it in the response.
  3. Match the user's fund-name(s) against the FundRow[] (case-insensitive substring).
     - If no match, list the available fundNames so the user can clarify.

COMPARISON FLOW (when user names ≥2 funds across ≥2 insurers/months):
  - Run the core loop once per (insurer, month) tuple.
  - Use replicate({ fanout: N }) for parallel fetch+extract when N >= 3.
  - Use run_code to merge the FundRow[]s into a single comparison table.
    Canonical columns to display (only those present in ≥1 row):
      fundName, insurer, monthLabel, nav, aumCr,
      oneYearReturn, threeYearReturn, fiveYearReturn,
      sinceInceptionReturn, expenseRatioPct
  - Sort by user-specified field (default: oneYearReturn desc, nulls last).
  - Round all returns to 2 decimal places.

OUTPUT:
  - Always post the comparison as a markdown table via post_to_chat.
  - Always include each row's sourceCacheId so the reviewer can click through
    (the chat UI renders /api/insurance/factsheet/{cacheId}/pdf as a download link).
  - Always cite the source PDF URL alongside each numeric claim — never compute from
    memory.
  - Mark "Not disclosed" (rendered as "—") for any null field; never estimate.

INVARIANTS:
  - You never produce fund return numbers without first calling extract.
  - You never claim a fund exists if it wasn't returned by extract.
  - When extract _confidence is "low", call out which fields are unreliable.
  - For non-curated insurers, mention "(via web search fallback)" in the comparison.`,
  outputSchema: factsheetAssistantOutputSchema,
  docPolicy: "optional",
  docChecklist: [
    { label: "Existing portfolio holdings", exampleFormats: [".csv", ".xlsx"] },
    { label: "Risk profile / Investment Policy Statement", exampleFormats: [".pdf"] },
  ],
  reviewerRoleHint: "Investment advisor / portfolio analyst",
  selfImprovementPolicy: {
    learningMemory:  { enabled: true, scope: "template+user", piiScanner: true },
    modifyOwnPrompt: { enabled: true, autoPromote: false },
    spawnSubagent:   { enabled: true, maxDepth: 3 },
    replicate:       { enabled: true, maxFanout: 25 },
  },
  version: 1,
};
