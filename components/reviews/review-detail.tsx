"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { renderTemplateOutput } from "./renderers";
import { AuditTrailFeed } from "./audit-trail-feed";

type Step = {
  id: string; tickNumber: number; stepNumber: number;
  kind: string; toolSlug: string | null;
  payload: unknown; createdAt: string;
};

type ReviewPayload = {
  review: {
    id: string; runId: string; agentId: string;
    templateSlug: string | null; templateVersion: number | null;
    status: string;
    outputJson: unknown;
    outputSummary: string | null;
    citationsJson: unknown;
    blockedToolCallsJson: Array<{ toolSlug: string; args: unknown }> | null;
    createdAt: string; decisionAt: string | null;
    agent: { id: string; name: string; userId: string; templateSlug: string | null };
    run: { id: string; startedAt: string; completedAt: string | null; knowledgeSourceIds: string[] };
    approver: { id: string; name: string } | null;
  };
  steps: Step[];
};

const TABS = ["output", "audit", "citations", "replay"] as const;

export function ReviewDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ReviewPayload | null>(null);
  const [tab, setTab] = useState<typeof TABS[number]>("output");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!params?.id) return;
    void (async () => {
      const res = await fetch(`/api/reviews/${params.id}`);
      if (res.ok) setData(await res.json());
    })();
  }, [params?.id]);

  async function decide(decision: "approved" | "changes_requested" | "rejected") {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/reviews/${params.id}/decide`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: note || undefined }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      const refetched = await (await fetch(`/api/reviews/${params.id}`)).json();
      setData(refetched);
    } catch (e) { setError(e instanceof Error ? e.message : "failed"); }
    finally { setBusy(false); }
  }

  async function replay() {
    if (!data) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/runs/${data.review.runId}/replay`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      const { replayRunId } = await res.json();
      router.push(`/agents?selected=${data.review.agentId}&run=${replayRunId}`);
    } catch (e) { setError(e instanceof Error ? e.message : "failed"); }
    finally { setBusy(false); }
  }

  if (!data) return <p className="px-6 py-4 text-sm text-gray-500">Loading…</p>;
  const r = data.review;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <header className="mb-3">
        <p className="text-[11px] uppercase tracking-wider text-gray-500">{r.templateSlug ?? "custom"} · v{r.templateVersion ?? "—"}</p>
        <h1 className="text-xl font-semibold text-gray-900">{r.agent.name}</h1>
        <p className="mt-1 text-xs text-gray-500">
          Run #{r.runId.slice(0, 8)} · {new Date(r.createdAt).toLocaleString()} · status <span className="font-mono">{r.status}</span>
          {r.approver ? ` · decided by ${r.approver.name}` : ""}
        </p>
      </header>

      <div className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={
              "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium " +
              (tab === t ? "border-[#0085CF] bg-[#0085CF] text-white" : "border-gray-200 bg-white text-gray-600")
            }>
            {t}
          </button>
        ))}
      </div>

      {tab === "output" && (
        <div>
          {renderTemplateOutput(r.templateSlug, r.outputJson)}
          {r.blockedToolCallsJson?.length ? (
            <section className="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2">
              <h3 className="font-semibold text-amber-800">Queued actions ({r.blockedToolCallsJson.length})</h3>
              <p className="text-xs text-amber-700">These will dispatch on Approve.</p>
              <ul className="ml-5 mt-1 list-disc text-xs">
                {r.blockedToolCallsJson.map((c, i) => <li key={i}><code>{c.toolSlug}</code></li>)}
              </ul>
            </section>
          ) : null}
          {r.status === "pending" ? (
            <div className="mt-4 rounded-lg border bg-white p-3">
              <textarea
                placeholder="Reviewer note (optional)…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
                rows={2}
              />
              {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
              <div className="mt-2 flex gap-2">
                <button onClick={() => decide("approved")} disabled={busy} className="cursor-pointer rounded-full bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-50">Approve & dispatch</button>
                <button onClick={() => decide("changes_requested")} disabled={busy} className="cursor-pointer rounded-full bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50">Request changes</button>
                <button onClick={() => decide("rejected")} disabled={busy} className="cursor-pointer rounded-full bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50">Reject</button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {tab === "audit" && <AuditTrailFeed steps={data.steps} />}

      {tab === "citations" && (
        <div>
          {Array.isArray(r.citationsJson) && r.citationsJson.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {(r.citationsJson as Array<{ title: string; url?: string; citationType: string }>).map((c, i) => (
                <li key={i} className="rounded border px-3 py-2">
                  <span className="mr-2 text-[11px] uppercase text-gray-500">{c.citationType}</span>
                  {c.url
                    ? <a href={c.url} target="_blank" rel="noreferrer" className="text-[#0085CF] hover:underline">{c.title}</a>
                    : <span>{c.title}</span>}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-gray-500">No citations recorded.</p>}
        </div>
      )}

      {tab === "replay" && (
        <div className="rounded-lg border bg-white p-4">
          <h3 className="font-semibold text-gray-900">Replay this run</h3>
          <p className="mt-1 text-sm text-gray-700">
            Re-executes the agent with the EXACT prompt + memory + knowledge sources captured at the original run start.
            Useful for audit and reproducibility checks.
          </p>
          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
          <button disabled={busy} onClick={replay}
            className="mt-3 cursor-pointer rounded-full bg-[#0085CF] px-3 py-1.5 text-sm text-white disabled:opacity-50">
            Replay run
          </button>
        </div>
      )}
    </div>
  );
}
