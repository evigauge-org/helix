import type { ReactNode } from "react";
import { KycScreenerRenderer } from "./kyc-screener";
import { EarningsReviewerRenderer } from "./earnings-reviewer";
import { GlReconcilerRenderer } from "./gl-reconciler";
import { StatementAuditorRenderer } from "./statement-auditor";
import { IndiaCaAuditAssistantRenderer } from "./india-ca-audit-assistant";
import { IndiaCfoInsightAssistantRenderer } from "./india-cfo-insight-assistant";
import { IndiaInsuranceFactsheetAssistantRenderer } from "./india-insurance-factsheet-assistant";

export function renderTemplateOutput(slug: string | null, output: unknown): ReactNode {
  if (!output) return <p className="text-sm text-gray-500">No output.</p>;
  if (slug === "kyc-screener") return <KycScreenerRenderer output={output as never} />;
  if (slug === "earnings-reviewer") return <EarningsReviewerRenderer output={output as never} />;
  if (slug === "gl-reconciler") return <GlReconcilerRenderer output={output as never} />;
  if (slug === "statement-auditor") return <StatementAuditorRenderer output={output as never} />;
  if (slug === "india-ca-audit-assistant") return <IndiaCaAuditAssistantRenderer output={output as never} />;
  if (slug === "india-cfo-insight-assistant") return <IndiaCfoInsightAssistantRenderer output={output as never} />;
  if (slug === "india-insurance-factsheet-assistant") return <IndiaInsuranceFactsheetAssistantRenderer output={output as never} />;
  return <pre className="whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs">{JSON.stringify(output, null, 2)}</pre>;
}
