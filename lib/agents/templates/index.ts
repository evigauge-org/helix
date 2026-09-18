import { zodToJsonSchema } from "zod-to-json-schema";
import { prisma } from "@/lib/prisma";
import type { AgentTemplateConfig } from "./types";
import { kycScreenerTemplate } from "./kyc-screener";
import { earningsReviewerTemplate } from "./earnings-reviewer";
import { glReconcilerTemplate } from "./gl-reconciler";
import { statementAuditorTemplate } from "./statement-auditor";
import { ibPitchBookOrchestratorTemplate } from "./ib-pitch-book-orchestrator";
import { ibTargetProfileTemplate } from "./ib-target-profile";
import { ibAcquirerScreenerTemplate } from "./ib-acquirer-screener";
import { ibAcquirerDeepDiveTemplate } from "./ib-acquirer-deep-dive";
import { ibCompTransactionsTemplate } from "./ib-comp-transactions";
import { ibCompetitiveLandscapeTemplate } from "./ib-competitive-landscape";
import { ibValuationTemplate } from "./ib-valuation";
import { ibRecommendationTemplate } from "./ib-recommendation";
import { indiaCaAuditAssistantTemplate } from "./india-ca-audit-assistant";
import { indiaCfoInsightAssistantTemplate } from "./india-cfo-insight-assistant";
import { indiaInsuranceFactsheetAssistantTemplate } from "./india-insurance-factsheet-assistant";

export const TEMPLATES: AgentTemplateConfig[] = [
  kycScreenerTemplate,
  earningsReviewerTemplate,
  glReconcilerTemplate,
  statementAuditorTemplate,
  // IB Pitch Book family
  ibPitchBookOrchestratorTemplate,
  ibTargetProfileTemplate,
  ibAcquirerScreenerTemplate,
  ibAcquirerDeepDiveTemplate,
  ibCompTransactionsTemplate,
  ibCompetitiveLandscapeTemplate,
  ibValuationTemplate,
  ibRecommendationTemplate,
  // India gov-data family
  indiaCaAuditAssistantTemplate,
  indiaCfoInsightAssistantTemplate,
  indiaInsuranceFactsheetAssistantTemplate,
];

const TEMPLATE_BY_SLUG = new Map(TEMPLATES.map((t) => [t.slug, t]));

export function getTemplateConfig(slug: string): AgentTemplateConfig | undefined {
  return TEMPLATE_BY_SLUG.get(slug);
}

export async function seedAgentTemplates(): Promise<{ upserted: number }> {
  let upserted = 0;
  for (const t of TEMPLATES) {
    // zod-to-json-schema@3 was authored for zod v3; this codebase uses zod v4.
    // Runtime conversion still works (it walks _def shapes), but the package's
    // typed signature only accepts zod/v3 ZodSchema, so we cast at the boundary.
    const outputSchemaJson = zodToJsonSchema(
      t.outputSchema as unknown as Parameters<typeof zodToJsonSchema>[0],
      { name: t.slug, target: "openApi3" },
    );
    await prisma.agentTemplate.upsert({
      where: { slug: t.slug },
      create: {
        slug: t.slug,
        name: t.name,
        category: t.category,
        goal: t.goal,
        description: t.description,
        iconName: t.iconName,
        defaultToolSlugs: t.defaultToolSlugs,
        defaultSkillIds: t.defaultSkillIds ?? [],
        systemPromptBase: t.systemPromptBase,
        outputSchemaJson,
        docPolicy: t.docPolicy,
        docChecklistJson: t.docChecklist,
        reviewerRoleHint: t.reviewerRoleHint,
        selfImprovementPolicyJson: t.selfImprovementPolicy,
        version: t.version,
        enabled: true,
      },
      update: {
        name: t.name,
        category: t.category,
        goal: t.goal,
        description: t.description,
        iconName: t.iconName,
        defaultToolSlugs: t.defaultToolSlugs,
        defaultSkillIds: t.defaultSkillIds ?? [],
        systemPromptBase: t.systemPromptBase,
        outputSchemaJson,
        docPolicy: t.docPolicy,
        docChecklistJson: t.docChecklist,
        reviewerRoleHint: t.reviewerRoleHint,
        selfImprovementPolicyJson: t.selfImprovementPolicy,
        version: t.version,
        enabled: true,
      },
    });
    upserted++;
  }
  return { upserted };
}
