import { z } from "zod";
import type { AgentTemplateConfig } from "./types";

const outputSchema = z.object({
  company: z.object({ ticker: z.string(), name: z.string(), sector: z.string().optional() }),
  period: z.object({ fiscalQuarter: z.string(), fiscalYear: z.string(), reportDate: z.string() }),
  keyMetrics: z.array(z.object({
    name: z.string(),
    reported: z.string(),
    consensus: z.string().optional(),
    beatMissPct: z.number().optional(),
    yoyPct: z.number().optional(),
  })),
  guidance: z.object({
    fyOutlook: z.string(),
    change: z.enum(["raised", "lowered", "reaffirmed", "introduced"]),
    details: z.string(),
  }),
  segments: z.array(z.object({
    name: z.string(),
    revenue: z.string(),
    yoyPct: z.number().optional(),
    commentary: z.string(),
  })),
  thesisImpact: z.object({
    rating: z.enum(["positive", "neutral", "negative"]),
    drivers: z.array(z.string()),
    confidence: z.number().min(0).max(1),
  }),
  recommendedActions: z.array(z.object({ action: z.string(), rationale: z.string() })),
  sources: z.array(z.object({
    title: z.string(),
    url: z.string().optional(),
    citationType: z.enum(["knowledge", "web", "fetch"]),
  })),
});

export const earningsReviewerTemplate: AgentTemplateConfig = {
  slug: "earnings-reviewer",
  name: "Earnings Reviewer",
  category: "research",
  iconName: "TrendingUp",
  goal: "Read earnings transcript and filings, surface thesis-relevant changes, and draft an analyst note for the research lead.",
  description: "Pulls quarter results from filings + transcripts (uploaded or fetched), highlights guidance changes, and stages a research-lead review.",
  defaultToolSlugs: [
    "search_knowledge",
    "llm_reason",
    "web_search",
    "fetch_url",
    "screener_company",
    "llm_debate",
    "run_code",
    "create_docx",
    "post_to_chat",
  ],
  systemPromptBase: `You are the Earnings Reviewer. Your job is to read the latest filings/transcripts for a company-period and produce a structured earnings note.

Always:
- If the user uploaded a 10-Q, 10-K, or transcript, use search_knowledge first.
- If no docs are uploaded, fetch from the IR site / SEC EDGAR via web_search + fetch_url.
- For Indian-listed companies, use screener_company({ticker, segment}) to fetch overview ratios, P&L history, balance sheet, cash flow, ratios, shareholding, peers, and growth before reasoning. The response includes a sector: "generic" | "banking" | "nbfc" discriminator — interpret P&L and balance-sheet fields per sector (e.g. NII for banks, financingMargin for NBFCs). Cite specific values from the response, not memory.
- For high-stakes thesis-impact judgments, use llm_debate.
- Use run_code for any quantitative reconciliation, variance, or YoY calculation — do not perform arithmetic from memory.
- Cite every metric and guidance claim with a knowledge source or fetched URL.
- Never broadcast post_to_chat or send_email without approval — drafts will queue.
- Output MUST conform to the structured schema. Do not return free-form prose.`,
  outputSchema,
  docPolicy: "optional",
  docChecklist: [
    { label: "10-Q / 10-K filing", exampleFormats: [".pdf"] },
    { label: "Earnings call transcript", exampleFormats: [".pdf", ".txt"] },
    { label: "Prior internal model", exampleFormats: [".csv", ".xlsx"] },
    { label: "Sell-side notes (optional)", exampleFormats: [".pdf"] },
  ],
  reviewerRoleHint: "Research lead",
  selfImprovementPolicy: {
    learningMemory:  { enabled: true, scope: "template+user", piiScanner: false },
    modifyOwnPrompt: { enabled: true, autoPromote: true },
    spawnSubagent:   { enabled: true, maxDepth: 2 },
    replicate:       { enabled: true, maxFanout: 25 },
  },
  version: 3,
};
