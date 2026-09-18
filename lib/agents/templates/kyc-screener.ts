import { z } from "zod";
import type { AgentTemplateConfig } from "./types";

const outputSchema = z.object({
  entity: z.object({
    legalName: z.string(),
    registrationNumber: z.string().optional(),
    jurisdiction: z.string().optional(),
    type: z.string().optional(),
  }),
  documentsReviewed: z.array(z.object({
    filename: z.string(),
    type: z.string(),
    status: z.enum(["complete", "incomplete", "expired", "unreadable"]),
  })),
  completeness: z.object({
    score: z.number().min(0).max(10),
    missing: z.array(z.string()),
  }),
  parties: z.array(z.object({
    name: z.string(),
    role: z.string(),
    idVerified: z.boolean(),
    sanctionsHit: z.boolean(),
    pepHit: z.boolean(),
    notes: z.string().optional(),
  })),
  riskAssessment: z.object({
    tier: z.enum(["low", "medium", "high", "prohibited"]),
    drivers: z.array(z.string()),
  }),
  gaps: z.array(z.object({
    severity: z.enum(["low", "medium", "high"]),
    what: z.string(),
    recommendedAction: z.string(),
  })),
  escalation: z.object({
    required: z.boolean(),
    to: z.string(),
    rationale: z.string(),
  }),
});

export const kycScreenerTemplate: AgentTemplateConfig = {
  slug: "kyc-screener",
  name: "KYC Screener",
  category: "compliance",
  iconName: "ShieldCheck",
  goal: "Parse onboarding documents, check completeness, screen entities and parties against sanctions/PEP rules, flag gaps, and route to compliance for sign-off.",
  description: "Reads onboarding packs, runs completeness + entity/party checks, classifies risk, and stages a compliance-officer review.",
  defaultToolSlugs: [
    "search_knowledge",
    "llm_reason",
    "web_search",
    "fetch_url",
    "create_docx",
    "send_email",
  ],
  systemPromptBase: `You are the KYC Screener. Your job is to take a set of uploaded onboarding documents and produce a structured KYC review report for a human compliance officer.

Always:
- Use search_knowledge first to find evidence in uploaded documents before relying on web_search.
- Cite the source document filename and (when known) page number for every factual claim.
- Set escalation.required = true whenever riskAssessment.tier is "high" or "prohibited", or completeness.score < 7.
- Never finalize a send_email — drafts to compliance will be queued and dispatched only after a human approves the review.
- Output MUST conform to the structured schema. Do not return free-form prose; the runner will validate.`,
  outputSchema,
  docPolicy: "required",
  docChecklist: [
    { label: "Entity registration certificate", exampleFormats: [".pdf"] },
    { label: "UBO declaration", exampleFormats: [".pdf"] },
    { label: "IDs / passports of UBOs", exampleFormats: [".pdf", ".png", ".jpg"] },
    { label: "Proof of address", exampleFormats: [".pdf"] },
    { label: "Source-of-wealth declaration", exampleFormats: [".pdf"] },
    { label: "Sanctions / PEP self-declaration", exampleFormats: [".pdf"] },
  ],
  reviewerRoleHint: "Compliance officer",
  selfImprovementPolicy: {
    learningMemory:  { enabled: true, scope: "template+user", piiScanner: true },
    modifyOwnPrompt: { enabled: true, autoPromote: false },
    spawnSubagent:   { enabled: true, maxDepth: 2 },
    replicate:       { enabled: true, maxFanout: 50 },
  },
  version: 1,
};
