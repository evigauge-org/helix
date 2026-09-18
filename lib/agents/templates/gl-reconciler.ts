import { z } from "zod";
import type { AgentTemplateConfig } from "./types";

const outputSchema = z.object({
  period: z.object({
    startDate: z.string(),
    endDate: z.string(),
    periodType: z.enum(["month", "quarter", "year", "custom"]),
  }),
  accountsReconciled: z.array(z.object({
    glAccount: z.string(),
    glBalance: z.number(),
    subBalance: z.number(),
    variance: z.number(),
    materialityFlag: z.boolean(),
  })),
  breaks: z.array(z.object({
    id: z.string(),
    glAccount: z.string(),
    varianceAmount: z.number(),
    severity: z.enum(["minor", "material", "critical"]),
    rootCause: z.string(),
    evidenceCitations: z.array(z.string()),
    suggestedJournalEntry: z.object({
      dr: z.string(),
      cr: z.string(),
      amount: z.number(),
      narrative: z.string(),
    }).optional(),
    ownerSuggested: z.string().optional(),
  })),
  summary: z.object({
    totalBreaks: z.number(),
    materialBreaks: z.number(),
    totalVariance: z.number(),
    signoffReadiness: z.boolean(),
  }),
  openItems: z.array(z.object({ description: z.string(), owner: z.string(), eta: z.string() })),
});

export const glReconcilerTemplate: AgentTemplateConfig = {
  slug: "gl-reconciler",
  name: "GL Reconciler",
  category: "finance-ops",
  iconName: "BarChart3",
  goal: "Reconcile GL trial balance against sub-ledgers, find breaks, trace root cause, and propose journal entries (never posted) for controller sign-off.",
  description: "Compares GL TB against AR/AP/Inventory/Bank sub-ledgers, finds variances, suggests journal entries (proposed only), and stages controller review.",
  defaultToolSlugs: [
    "search_knowledge",
    "llm_reason",
    "run_code",
    "create_enterprise_report",
    "write_rows",
    "create_docx",
    "send_email",
  ],
  systemPromptBase: `You are the GL Reconciler. Your job is to reconcile a general ledger trial balance against sub-ledger reports for a defined period.

Always:
- Use search_knowledge to read uploaded GL TB and sub-ledger files. Match account numbers to sub-ledger totals.
- Use run_code for any quantitative reconciliation, variance, or YoY calculation — do not perform arithmetic from memory.
- For every variance above the materiality threshold (default $1,000 unless the user specifies), open a "break" entry. Trace its root cause from the documents.
- When proposing a journal entry, NEVER claim it has been posted. The output is suggested entries only — Helix has no ledger-write integration.
- Build a break-list workbook via create_enterprise_report (gated). Send a sign-off email to the controller (gated).
- Output MUST conform to the structured schema.`,
  outputSchema,
  docPolicy: "required",
  docChecklist: [
    { label: "GL trial balance", exampleFormats: [".csv", ".xlsx", ".pdf"] },
    { label: "AR sub-ledger", exampleFormats: [".csv", ".xlsx"] },
    { label: "AP sub-ledger", exampleFormats: [".csv", ".xlsx"] },
    { label: "Inventory sub-ledger", exampleFormats: [".csv", ".xlsx"] },
    { label: "Bank reconciliation", exampleFormats: [".pdf", ".csv"] },
    { label: "Prior-period recon (optional)", exampleFormats: [".pdf"] },
  ],
  reviewerRoleHint: "Controller / Finance lead",
  selfImprovementPolicy: {
    learningMemory:  { enabled: true, scope: "template+user", piiScanner: false },
    modifyOwnPrompt: { enabled: true, autoPromote: false },
    spawnSubagent:   { enabled: true, maxDepth: 1 },
    replicate:       { enabled: true, maxFanout: 12 },
  },
  version: 2,
};
