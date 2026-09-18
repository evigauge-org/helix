"use client";

import { useEffect, useMemo, useState } from "react";
import { createId } from "@paralleldrive/cuid2";
import { Sparkles, X } from "lucide-react";
import { KnowledgeUploader } from "./knowledge-uploader";
import type { KnowledgeSourceRowData } from "./knowledge-source-row";
import { DocChecklist, checklistSatisfied, type ChecklistItem } from "./doc-checklist";

const TOOL_OPTIONS = [
  "web_search", "fetch_url", "llm_reason", "run_code", "screener_company",
  "sec_edgar_company_search", "sec_edgar_filings", "sec_edgar_xbrl_facts",
  "yahoo_finance_quote", "yahoo_finance_financials", "macrotrends_history",
  "crunchbase_company", "precedent_transactions_search", "precedent_transaction_extract",
  "valuation_football_field", "acquirer_capacity_score",
  "assemble_ib_pitch_book",
  "data_gov_in_catalog_search", "data_gov_in_dataset_fetch",
  "india_rbi_policy_rates", "india_rbi_fx_reference_rates",
  "india_mospi_cpi", "india_mospi_wpi",
  "india_sebi_mutual_fund_aum", "india_gdp_series", "india_iip_index",
  "india_insurance_factsheet_fetch",
  "india_insurance_factsheet_extract",
  "save_artifact", "send_email", "post_to_chat",
  "create_enterprise_report", "write_rows", "get_spreadsheet", "find_spreadsheet",
  "get_market_price", "get_option_chain", "update_dashboard",
  "download_file", "download_nse_report",
  "create_canva_presentation", "create_pptx", "import_canva_from_file",
  "create_canva_design", "get_canva_design_metadata", "list_canva_designs",
  "llm_debate", "create_docx",
  "source_linkedin_profiles", "scrape_firm_directory", "cross_reference_candidate",
  "search_knowledge",
];

export type DialogTemplate = {
  slug: string;
  name: string;
  goal: string;
  description: string;
  defaultToolSlugs: string[];
  docPolicy: "required" | "optional";
  docChecklistJson: ChecklistItem[];
  reviewerRoleHint?: string | null;
  version: number;
};

export function CreateAgentDialog({
  open,
  onClose,
  onCreated,
  template,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (agentId: string) => void;
  template?: DialogTemplate | null;
}) {
  const draftToken = useMemo(() => (open ? createId() : ""), [open]);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [systemPromptExtra, setSystemPromptExtra] = useState("");
  const [toolSlugs, setToolSlugs] = useState<Set<string>>(new Set(["web_search", "llm_reason"]));
  const [sources, setSources] = useState<KnowledgeSourceRowData[]>([]);
  const [autoFilling, setAutoFilling] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill name/goal/tools from the template the first time it shows up.
  // We only set fields that are currently empty so a user-typed value isn't
  // clobbered if they reopen the dialog with the same template.
  useEffect(() => {
    if (!template) return;
    setName((prev) => prev || template.name);
    setGoal((prev) => prev || template.goal);
    setToolSlugs((prev) => {
      // Always include the template defaults plus search_knowledge (RAG spine)
      const next = new Set(prev);
      for (const s of template.defaultToolSlugs) next.add(s);
      next.add("search_knowledge");
      return next;
    });
  }, [template]);

  const readyCount = sources.filter((s) => s.status === "ready").length;
  const requiredSatisfied = !template || template.docPolicy !== "required"
    ? true
    : checklistSatisfied(
        template.docChecklistJson,
        sources.map((s) => ({ id: s.id, filename: s.filename, status: s.status })),
      );

  async function autoFill() {
    setAutoFilling(true);
    setError(null);
    try {
      const res = await fetch("/api/agents/auto-populate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftToken }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setError(json.error ?? `Auto-fill failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as {
        name: string;
        goal: string;
        systemPromptExtra: string;
        toolSlugs: string[];
      };
      if (!name) setName(data.name);
      if (!goal) setGoal(data.goal);
      if (!systemPromptExtra) setSystemPromptExtra(data.systemPromptExtra);
      setToolSlugs((prev) => new Set([...prev, ...data.toolSlugs]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auto-fill failed");
    } finally {
      setAutoFilling(false);
    }
  }

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          goal,
          systemPromptExtra: systemPromptExtra || undefined,
          toolSlugs: Array.from(toolSlugs),
          createdBy: template ? "template" : "form",
          draftToken,
          templateSlug: template?.slug,
        }),
      });
      if (!res.ok) {
        const txt = await res.text();
        setError(txt || `Create failed (${res.status})`);
        return;
      }
      const json = (await res.json()) as { agentId: string };
      onCreated(json.agentId);
    } finally {
      setCreating(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            {template ? `New ${template.name}` : "New Agent"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {template ? (
            <div className="rounded-md border border-[#0085CF]/20 bg-[#0085CF]/5 px-3 py-1.5 text-[11px] text-[#0085CF]">
              Powered by template <span className="font-mono">{template.slug}</span> · v{template.version}
              {template.reviewerRoleHint ? <> · reviewer: <span className="font-medium">{template.reviewerRoleHint}</span></> : null}
            </div>
          ) : null}

          {template ? (
            <DocChecklist
              policy={template.docPolicy}
              items={template.docChecklistJson}
              files={sources.map((s) => ({ id: s.id, filename: s.filename, status: s.status }))}
            />
          ) : null}

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Knowledge sources {template?.docPolicy === "required" ? "(required)" : "(optional)"}
            </h3>
            <KnowledgeUploader
              target={{ mode: "draft", draftToken }}
              onSourcesChange={setSources}
            />
          </section>

          {readyCount > 0 ? (
            <button
              type="button"
              disabled={autoFilling}
              onClick={autoFill}
              className="flex items-center gap-2 rounded-md border border-[#0085CF] bg-[#0085CF]/5 px-3 py-2 text-sm font-medium text-[#0085CF] hover:bg-[#0085CF]/10 disabled:opacity-50"
            >
              <Sparkles className="size-4" />
              {autoFilling ? "Reading your knowledge…" : "Auto-fill from knowledge"}
            </button>
          ) : null}

          <section className="space-y-3">
            <Field label="Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#0085CF]/50 focus:outline-none focus:ring-2 focus:ring-[#0085CF]/15"
                placeholder="e.g. Equity Research Analyst"
              />
            </Field>
            {template?.slug === "ib-pitch-book-orchestrator" && (
              <Field label="Acquirer list (optional — paste 8 names/tickers comma-separated; leave blank to let the agent screen)">
                <textarea
                  rows={2}
                  placeholder="e.g. MSFT, ORCL, CRM, ADBE, NOW, WDAY, INTU, IBM"
                  onChange={(e) => setSystemPromptExtra(`Acquirer list: ${e.target.value}\n\n${systemPromptExtra}`)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#0085CF]/50 focus:outline-none focus:ring-2 focus:ring-[#0085CF]/15"
                />
              </Field>
            )}
            <Field label="Goal">
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                maxLength={500}
                rows={2}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#0085CF]/50 focus:outline-none focus:ring-2 focus:ring-[#0085CF]/15"
                placeholder="One sentence — what should this agent accomplish?"
              />
            </Field>
            <Field label="System prompt extra (optional)">
              <textarea
                value={systemPromptExtra}
                onChange={(e) => setSystemPromptExtra(e.target.value)}
                maxLength={2000}
                rows={4}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#0085CF]/50 focus:outline-none focus:ring-2 focus:ring-[#0085CF]/15"
                placeholder="Operating principles, constraints, tone."
              />
            </Field>
            <Field label="Tools">
              <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto rounded-md border border-gray-200 p-2 text-xs">
                {TOOL_OPTIONS.map((slug) => (
                  <label key={slug} className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={toolSlugs.has(slug)}
                      onChange={(e) => {
                        setToolSlugs((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(slug);
                          else next.delete(slug);
                          return next;
                        });
                      }}
                    />
                    <code className="text-[11px] text-gray-700">{slug}</code>
                  </label>
                ))}
              </div>
            </Field>
          </section>

          {template ? (
            <p className="text-[11px] text-gray-500">
              This agent learns from runs (memory + prompt suggestions). For compliance-grade templates,
              prompt updates require your explicit approval before applying.
            </p>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={creating || !name.trim() || !goal.trim() || !requiredSatisfied}
            onClick={create}
            className="rounded-md bg-[#0085CF] px-3 py-2 text-sm font-medium text-white hover:bg-[#0070b3] disabled:opacity-50"
            title={!requiredSatisfied ? "Upload all required documents to enable Run" : ""}
          >
            {creating ? "Creating…" : template ? "Run now" : "Create Agent"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}
