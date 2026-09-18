"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Row = {
  id: string;
  runId: string;
  agentId: string;
  templateSlug: string | null;
  status: string;
  outputSummary: string | null;
  decisionAt: string | null;
  createdAt: string;
  agent: { name: string };
};

const STATUSES = ["pending", "approved", "changes_requested", "rejected"] as const;

function labelFor(s: string): string {
  return s === "pending" ? "Pending" :
    s === "approved" ? "Approved" :
    s === "changes_requested" ? "Changes requested" :
    s === "rejected" ? "Rejected" : s;
}

export function ReviewInbox({ agentId }: { agentId?: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<typeof STATUSES[number]>("pending");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void (async () => {
      const params = new URLSearchParams({ status, sinceDays: "30" });
      if (agentId) params.set("agentId", agentId);
      const res = await fetch(`/api/reviews?${params.toString()}`);
      if (res.ok) {
        const { reviews } = (await res.json()) as { reviews: Row[] };
        setRows(reviews);
      }
      setLoading(false);
    })();
  }, [status, agentId]);

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {STATUSES.map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)}
            className={
              "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium " +
              (status === s
                ? "border-[#0085CF] bg-[#0085CF] text-white"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300")
            }>
            {labelFor(s)}
          </button>
        ))}
      </div>
      {loading ? <p className="text-sm text-gray-500">Loading…</p> : null}
      <ul className="divide-y rounded-lg border bg-white">
        {rows.map((r) => (
          <li key={r.id} className="px-4 py-3 hover:bg-gray-50">
            <Link href={`/reviews/${r.id}`} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{r.agent.name}</p>
                <p className="text-xs text-gray-500">
                  {r.templateSlug ?? "custom"} · {new Date(r.createdAt).toLocaleString()}
                </p>
                {r.outputSummary ? <p className="mt-1 text-sm text-gray-700">{r.outputSummary}</p> : null}
              </div>
              <span className="text-sm text-[#0085CF]">Review →</span>
            </Link>
          </li>
        ))}
        {!loading && rows.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-gray-500">No {labelFor(status).toLowerCase()} reviews.</li>
        ) : null}
      </ul>
    </div>
  );
}
