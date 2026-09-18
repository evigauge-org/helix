"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Spec = {
  name: string;
  goal: string;
  suggestedTools: string[];
  rationale: string;
  templateSlug?: string;
};

const ALL_TOOLS = [
  { slug: "web_search", label: "Web search (Exa)" },
  { slug: "fetch_url", label: "Fetch URL" },
  { slug: "llm_reason", label: "LLM reason" },
  { slug: "run_code", label: "Run code (Python/JS sandbox)" },
  { slug: "screener_company", label: "Screener.in (Indian listed companies)" },
  { slug: "sec_edgar_company_search", label: "SEC EDGAR — Company search" },
  { slug: "sec_edgar_filings", label: "SEC EDGAR — Filings list" },
  { slug: "sec_edgar_xbrl_facts", label: "SEC EDGAR — XBRL financials" },
  { slug: "yahoo_finance_quote", label: "Yahoo Finance — Quote + multiples" },
  { slug: "yahoo_finance_financials", label: "Yahoo Finance — Historical financials" },
  { slug: "macrotrends_history", label: "Macrotrends — 10-20yr history" },
  { slug: "crunchbase_company", label: "Crunchbase — Company + acquisitions" },
  { slug: "precedent_transactions_search", label: "Precedent M&A — Candidate finder" },
  { slug: "precedent_transaction_extract", label: "Precedent M&A — Extract deal terms" },
  { slug: "valuation_football_field", label: "Valuation — Football field" },
  { slug: "acquirer_capacity_score", label: "Valuation — Acquirer capacity score" },
  { slug: "assemble_ib_pitch_book", label: "IB — Assemble pitch book (PPTX + XLSX)" },
  { slug: "data_gov_in_catalog_search", label: "data.gov.in — Catalog search" },
  { slug: "data_gov_in_dataset_fetch", label: "data.gov.in — Dataset fetch" },
  { slug: "india_rbi_policy_rates", label: "India — RBI policy rates" },
  { slug: "india_rbi_fx_reference_rates", label: "India — RBI FX reference rates" },
  { slug: "india_mospi_cpi", label: "India — MoSPI CPI" },
  { slug: "india_mospi_wpi", label: "India — MoSPI WPI" },
  { slug: "india_sebi_mutual_fund_aum", label: "India — SEBI mutual-fund AUM" },
  { slug: "india_gdp_series", label: "India — GDP series" },
  { slug: "india_iip_index", label: "India — IIP index" },
  { slug: "india_insurance_factsheet_fetch", label: "India — Insurance factsheet fetch" },
  { slug: "india_insurance_factsheet_extract", label: "India — Insurance factsheet extract" },
  { slug: "save_artifact", label: "Save artifact" },
  { slug: "send_email", label: "Send email (Gmail)" },
  { slug: "post_to_chat", label: "Post to this chat" },
  { slug: "create_enterprise_report", label: "Create Google Sheet" },
  { slug: "write_rows", label: "Append rows to Sheet" },
  { slug: "get_spreadsheet", label: "Read Google Sheet" },
  { slug: "find_spreadsheet", label: "Find Google Sheet by name" },
  { slug: "get_market_price", label: "Market price" },
  { slug: "get_option_chain", label: "Option chain" },
  { slug: "update_dashboard", label: "Live dashboard" },
  { slug: "download_file", label: "Download file" },
  { slug: "download_nse_report", label: "NSE daily reports" },
  { slug: "create_canva_presentation", label: "Canva presentation (one-shot)" },
  { slug: "create_pptx", label: "Create PPTX" },
  { slug: "import_canva_from_file", label: "Import to Canva" },
  { slug: "create_canva_design", label: "Canva blank canvas" },
  { slug: "get_canva_design_metadata", label: "Canva design info" },
  { slug: "list_canva_designs", label: "List Canva designs" },
  { slug: "llm_debate", label: "Multi-LLM debate (DD-grade)" },
  { slug: "create_docx", label: "Create branded DOCX" },
];

export function AgentSpecCard({
  spec,
  chatSessionId,
  draftToken,
}: {
  spec: Spec;
  chatSessionId: string | null;
  draftToken?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(spec.name);
  const [goal, setGoal] = useState(spec.goal);
  const [tools, setTools] = useState<string[]>(spec.suggestedTools);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function confirm() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, goal,
          // When a template was matched, omit toolSlugs — the /api/agents
          // POST handler fills toolSlugs from template.defaultToolSlugs and
          // pins templateVersion. Sending an explicit list would override
          // the template's curated defaults.
          toolSlugs: spec.templateSlug ? undefined : tools,
          createdBy: spec.templateSlug ? "template" : "chat",
          createdInChatId: chatSessionId ?? undefined,
          draftToken,
          templateSlug: spec.templateSlug,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const { agentId } = await res.json();
      setDone(true);
      router.push(`/agents?selected=${agentId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-2xl border-2 border-[#0085CF]/40 bg-gradient-to-br from-white to-[#0085CF]/5 p-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#0085CF]">
          {spec.templateSlug ? (
            <>Proposed Agent · <span className="text-emerald-700">template <span className="font-mono">{spec.templateSlug}</span></span></>
          ) : (
            "Proposed Agent"
          )}
        </p>
        {!editing && !done && !spec.templateSlug ? (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-gray-600 hover:text-[#0085CF] cursor-pointer">
            <Edit2 className="size-3" /> Edit
          </button>
        ) : null}
      </div>
      {spec.templateSlug ? (
        <p className="mt-1 text-[11px] text-gray-600">
          Tools and review pipeline come from the template — confirm to instantiate.
        </p>
      ) : null}

      <div className="mt-3">
        {editing ? (
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-gray-200 px-2 py-1 text-lg font-semibold" />
        ) : (
          <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
        )}
      </div>

      <div className="mt-2">
        <p className="text-xs uppercase tracking-wider text-gray-500">Goal</p>
        {editing ? (
          <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1 text-sm" />
        ) : (
          <p className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">{goal}</p>
        )}
      </div>

      {spec.templateSlug ? (
        <div className="mt-3">
          <p className="text-xs uppercase tracking-wider text-gray-500">Tools</p>
          <p className="mt-1 text-xs text-gray-600">
            Tools, system prompt, and review pipeline are pinned to this template. You can adjust the
            agent&apos;s tool set after creation from the agent detail page.
          </p>
          {spec.rationale ? <p className="mt-1.5 text-[11px] italic text-gray-500">{spec.rationale}</p> : null}
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-xs uppercase tracking-wider text-gray-500">Tools</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {ALL_TOOLS.map((t) => {
              const on = tools.includes(t.slug);
              return (
                <button
                  key={t.slug}
                  type="button"
                  disabled={!editing || done}
                  onClick={() => setTools((prev) => on ? prev.filter((x) => x !== t.slug) : [...prev, t.slug])}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    on ? "border-[#0085CF] bg-[#0085CF]/10 text-[#0085CF]" : "border-gray-200 bg-white text-gray-500",
                    editing && !done ? "cursor-pointer" : "cursor-default",
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          {spec.rationale ? <p className="mt-1.5 text-[11px] italic text-gray-500">{spec.rationale}</p> : null}
        </div>
      )}

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {done ? <p className="mt-2 text-xs text-green-700">Agent created — taking you to the dashboard…</p> : null}

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={confirm}
          disabled={busy || done || name.trim().length === 0 || goal.trim().length === 0 || (!spec.templateSlug && tools.length === 0)}
          className="flex items-center gap-1.5 rounded-full bg-[#0085CF] px-4 py-2 text-sm font-medium text-white hover:bg-[#006fa8] disabled:opacity-50 cursor-pointer"
        >
          <Check className="size-4" /> {busy ? "Creating..." : done ? "Created" : "Confirm & Run"}
        </button>
        {editing && !done ? (
          <button onClick={() => setEditing(false)} className="rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-600 cursor-pointer">
            Done editing
          </button>
        ) : null}
      </div>
    </div>
  );
}
