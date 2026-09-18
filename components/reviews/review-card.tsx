"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QueryResponse } from "@/lib/types";

type Card = NonNullable<QueryResponse["review_card"]>;

function statusLabel(s: string): string {
  return s === "pending" ? "pending review" :
    s === "approved" ? "approved" :
    s === "rejected" ? "rejected" :
    s === "changes_requested" ? "changes requested" : s;
}

function countLowConfidence(value: unknown): number {
  if (value === null || typeof value !== "object") return 0;
  if (Array.isArray(value)) return value.reduce<number>((s, v) => s + countLowConfidence(v), 0);
  let n = 0;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === "_confidence" && v === "low") n++;
    else n += countLowConfidence(v);
  }
  return n;
}

export function ReviewCard({ card }: { card: Card }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(card.status);
  const [error, setError] = useState<string | null>(null);
  const [lowConfidenceCount, setLowConfidenceCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/reviews/${card.reviewId}`);
        if (!res.ok) return;
        const body = await res.json() as { review?: { outputJson?: unknown } };
        const count = countLowConfidence(body.review?.outputJson);
        if (!cancelled) setLowConfidenceCount(count);
      } catch {
        // Silent — banner just won't render. Not worth alerting on.
      }
    })();
    return () => { cancelled = true; };
  }, [card.reviewId]);

  async function decide(decision: "approved" | "changes_requested" | "rejected") {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/reviews/${card.reviewId}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setStatus(decision);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn(
      "mt-3 rounded-2xl border-2 p-5",
      status === "pending" ? "border-amber-300 bg-amber-50/40" :
      status === "approved" ? "border-emerald-300 bg-emerald-50/40" :
      status === "rejected" ? "border-red-300 bg-red-50/40" :
      "border-blue-300 bg-blue-50/40",
    )}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
            {card.templateName} — <span className="text-gray-500">{statusLabel(status)}</span>
          </p>
          <h3 className="mt-1 text-base font-semibold text-gray-900">{card.title}</h3>
        </div>
        {card.reviewerRoleHint ? (
          <span className="text-xs text-gray-500">Reviewer: {card.reviewerRoleHint}</span>
        ) : null}
      </div>

      {lowConfidenceCount > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span className="font-medium">{lowConfidenceCount} low-confidence cell{lowConfidenceCount === 1 ? "" : "s"}</span>
          <span className="text-amber-700">— review marked items before approving</span>
        </div>
      )}

      <p className="mt-3 text-sm text-gray-800">{card.summary}</p>
      {card.queuedActionCount > 0 ? (
        <p className="mt-1 text-xs text-amber-700">
          {card.queuedActionCount} action{card.queuedActionCount === 1 ? "" : "s"} queued — will dispatch on approve
        </p>
      ) : null}

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

      {status === "pending" ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={() => decide("approved")} disabled={busy}
            className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer">
            <Check className="size-4" /> Approve & dispatch
          </button>
          <button onClick={() => decide("changes_requested")} disabled={busy}
            className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer">
            <RotateCcw className="size-4" /> Request changes
          </button>
          <button onClick={() => decide("rejected")} disabled={busy}
            className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer">
            <X className="size-4" /> Reject
          </button>
          <button onClick={() => router.push(`/reviews/${card.reviewId}`)}
            className="ml-auto rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
            View full report
          </button>
        </div>
      ) : (
        <div className="mt-4">
          <button onClick={() => router.push(`/reviews/${card.reviewId}`)}
            className="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
            View full report
          </button>
        </div>
      )}
    </div>
  );
}
