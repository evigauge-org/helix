import { z } from "zod";
import type { AgentTemplateConfig } from "./types";

const outputSchema = z.object({
  statementsReviewed: z.array(z.object({
    name: z.string(),
    period: z.string(),
    type: z.enum(["balance_sheet", "income_statement", "cash_flow", "equity", "notes", "other"]),
  })),
  consistencyChecks: z.array(z.object({
    check: z.string(),
    status: z.enum(["pass", "fail", "caveat"]),
    evidence: z.string(),
  })),
  findings: z.array(z.object({
    severity: z.enum(["critical", "material", "minor", "informational"]),
    area: z.string(),
    issue: z.string(),
    citationFromDocs: z.string(),
    recommendedAction: z.string(),
    standardRef: z.string().optional(),
  })),
  auditReadinessScore: z.number().min(0).max(100),
  recommendations: z.array(z.object({
    priority: z.enum(["urgent", "high", "medium", "low"]),
    action: z.string(),
    rationale: z.string(),
  })),
});

export const statementAuditorTemplate: AgentTemplateConfig = {
  slug: "statement-auditor",
  name: "Statement Auditor",
  category: "finance-ops",
  iconName: "FileCheck",
  goal: "Audit financial statements for internal consistency, accounting-rule conformance, and audit-readiness; produce a findings memo for the audit partner.",
  description: "Cross-checks B/S, P&L, CF and supporting schedules; produces severity-tagged findings + audit-readiness score, staged for partner review.",
  defaultToolSlugs: [
    "search_knowledge",
    "llm_reason",
    "llm_debate",
    "run_code",
    "create_docx",
    "web_search",
    "send_email",
  ],
  systemPromptBase: `You are the Statement Auditor. Your job is to audit a set of uploaded financial statements for internal consistency, accounting-rule conformance, and audit-readiness.

Always:
- Use search_knowledge across all uploaded statements. Cross-check P&L totals against the trial balance, balance-sheet equation, and cash-flow reconciliation against B/S deltas.
- For high-stakes consistency findings, run llm_debate to cross-validate.
- Use run_code for any quantitative reconciliation, variance, or YoY calculation — do not perform arithmetic from memory.
- The DOCX you produce will carry a "DRAFT — pending approval" watermark until the review is approved. Do not pretend it is final.
- Cite every finding with the source document filename and (when known) page or line.
- Output MUST conform to the structured schema.`,
  outputSchema,
  docPolicy: "required",
  docChecklist: [
    { label: "Balance sheet", exampleFormats: [".pdf", ".xlsx"] },
    { label: "Income statement", exampleFormats: [".pdf", ".xlsx"] },
    { label: "Cash flow statement", exampleFormats: [".pdf", ".xlsx"] },
    { label: "Trial balance", exampleFormats: [".csv", ".xlsx"] },
    { label: "Supporting schedules", exampleFormats: [".pdf", ".xlsx"] },
    { label: "Prior-year statements", exampleFormats: [".pdf"] },
    { label: "Accounting policy memo (optional)", exampleFormats: [".pdf"] },
  ],
  reviewerRoleHint: "Audit partner",
  selfImprovementPolicy: {
    learningMemory:  { enabled: true, scope: "template+user", piiScanner: false },
    modifyOwnPrompt: { enabled: true, autoPromote: false },
    spawnSubagent:   { enabled: true, maxDepth: 2 },
    replicate:       { enabled: true, maxFanout: 12 },
  },
  version: 2,
};
