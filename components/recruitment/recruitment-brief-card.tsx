// components/recruitment/recruitment-brief-card.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Users, Loader2, Plus, X, Sparkles, Check, AlertCircle } from "lucide-react";
import { useChatStore } from "@/stores/chat-store";

interface BriefResponse {
  filters: Record<string, unknown>;
  validation: Record<string, unknown>;
  suggestedSources: string[];
  suggestedRefinements: string[];
  agentName: string;
  agentGoal: string;
}

type Status = "extracting" | "ready" | "creating" | "done" | "error";

export function RecruitmentBriefCard({
  query,
  autoFire = true,
}: {
  query: string;
  autoFire?: boolean;
}) {
  const activeSessionId = useChatStore((s) => s.activeSessionId);

  const [status, setStatus] = useState<Status>(autoFire ? "extracting" : "ready");
  const [brief, setBrief] = useState<BriefResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customUrl, setCustomUrl] = useState("");
  const [enabledSources, setEnabledSources] = useState<Record<string, boolean>>({});
  const [customSources, setCustomSources] = useState<string[]>([]);
  const [agentName, setAgentName] = useState("");
  const [agentGoal, setAgentGoal] = useState("");
  const [maxCandidates, setMaxCandidates] = useState(20);
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const startedRef = useRef(false);

  // Fetch brief extraction on mount (once).
  useEffect(() => {
    if (!autoFire || startedRef.current) return;
    startedRef.current = true;
    (async () => {
      setStatus("extracting");
      setError(null);
      try {
        const res = await fetch("/api/recruitment/brief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? `Brief extraction failed (${res.status})`);
          setStatus("error");
          return;
        }
        setBrief(data as BriefResponse);
        setAgentName(data.agentName ?? "Recruitment Agent");
        setAgentGoal(data.agentGoal ?? query);
        const defaultSources: Record<string, boolean> = {};
        for (const url of data.suggestedSources ?? []) defaultSources[url] = true;
        setEnabledSources(defaultSources);
        setMaxCandidates(Number(data.filters?.maxItems ?? 20));
        setStatus("ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
        setStatus("error");
      }
    })();
  }, [autoFire, query]);

  function toggleSource(url: string) {
    setEnabledSources((s) => ({ ...s, [url]: !s[url] }));
  }
  function addCustomSource() {
    const raw = customUrl.trim();
    if (!raw) return;
    try { new URL(raw); } catch { setError("Not a valid URL"); return; }
    if (customSources.includes(raw)) return;
    setCustomSources((l) => [...l, raw]);
    setEnabledSources((s) => ({ ...s, [raw]: true }));
    setCustomUrl("");
    setError(null);
  }
  function removeCustom(url: string) {
    setCustomSources((l) => l.filter((u) => u !== url));
    setEnabledSources((s) => { const next = { ...s }; delete next[url]; return next; });
  }

  async function saveAndCreate() {
    if (!brief) return;
    setStatus("creating");
    setError(null);
    try {
      const allSourceUrls = [
        ...(brief.suggestedSources ?? []),
        ...customSources,
      ].filter((u) => enabledSources[u]);
      const res = await fetch("/api/recruitment/create-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatSessionId: activeSessionId,
          agentName,
          agentGoal,
          filters: brief.filters,
          validation: brief.validation,
          sourceUrls: allSourceUrls,
          maxCandidates,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Agent creation failed (${res.status})`);
        setStatus("error");
        return;
      }
      setCreatedAgentId(data.agent?.id ?? null);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setStatus("error");
    }
  }

  const allSources = [
    ...(brief?.suggestedSources ?? []),
    ...customSources,
  ];

  return (
    <div className="my-4 rounded-xl border border-[#0085CF]/15 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-[#0085CF]/10">
          <Users className="size-5 text-[#0085CF]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-800">Recruitment brief</p>
          <p className="truncate text-xs text-gray-500">{query}</p>
        </div>
      </div>

      {status === "extracting" && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-[#0085CF]">
          <Loader2 className="size-4 animate-spin" /> Reading your brief…
        </div>
      )}

      {status === "error" && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div className="flex-1">
            <p>{error ?? "Something went wrong"}</p>
          </div>
        </div>
      )}

      {(status === "ready" || status === "creating") && brief && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs">
              <span className="mb-1 block text-gray-600">Agent name</span>
              <input value={agentName} onChange={(e) => setAgentName(e.target.value)} className="w-full rounded border border-gray-200 px-2 py-1 text-sm" />
            </label>
            <label className="text-xs">
              <span className="mb-1 block text-gray-600">Max candidates</span>
              <input type="number" min={1} max={50} value={maxCandidates} onChange={(e) => setMaxCandidates(Math.min(50, Math.max(1, Number(e.target.value) || 20)))} className="w-full rounded border border-gray-200 px-2 py-1 text-sm" />
            </label>
          </div>
          <label className="text-xs block">
            <span className="mb-1 block text-gray-600">Agent goal</span>
            <textarea value={agentGoal} onChange={(e) => setAgentGoal(e.target.value)} rows={2} className="w-full rounded border border-gray-200 px-2 py-1 text-sm resize-none" />
          </label>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Data sources</p>
            <div className="space-y-1.5">
              {allSources.map((url) => (
                <label key={url} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!enabledSources[url]} onChange={() => toggleSource(url)} className="size-3.5 accent-[#0085CF]" />
                  <span className="truncate text-gray-700">{url}</span>
                  {customSources.includes(url) && (
                    <button type="button" onClick={() => removeCustom(url)} className="text-gray-400 hover:text-red-500 cursor-pointer" aria-label="remove"><X className="size-3.5" /></button>
                  )}
                </label>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <input value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="https://firmname.com/our-people/" className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs" />
              <button type="button" onClick={addCustomSource} className="flex items-center gap-1 rounded bg-[#0085CF] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#006BA6] cursor-pointer">
                <Plus className="size-3" /> Add
              </button>
            </div>
            <p className="mt-1 text-[11px] text-gray-500">Default LinkedIn sourcing via Apify is always enabled.</p>
          </div>

          {(brief.suggestedRefinements ?? []).length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
              <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-amber-800">
                <Sparkles className="size-3" /> Suggestions
              </p>
              <ul className="text-xs text-amber-900 space-y-0.5 list-disc list-inside">
                {brief.suggestedRefinements.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={status === "creating"}
              onClick={saveAndCreate}
              className="flex-1 rounded-lg bg-[#0085CF] px-4 py-2 text-sm font-medium text-white hover:bg-[#006BA6] disabled:opacity-50 cursor-pointer"
            >
              {status === "creating" ? (
                <span className="flex items-center justify-center gap-1.5"><Loader2 className="size-3.5 animate-spin" /> Creating agent…</span>
              ) : (
                "Save & create agent →"
              )}
            </button>
          </div>
        </div>
      )}

      {status === "done" && createdAgentId && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <Check className="size-4" />
          <span className="flex-1">Agent created and running.</span>
          <a href={`/agents?selected=${createdAgentId}`} target="_blank" rel="noopener noreferrer" className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 cursor-pointer">
            Open timeline
          </a>
        </div>
      )}
    </div>
  );
}
