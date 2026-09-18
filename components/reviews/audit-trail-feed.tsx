"use client";

import { useState } from "react";

type Step = {
  id: string;
  tickNumber: number;
  stepNumber: number;
  kind: string;
  toolSlug: string | null;
  payload: unknown;
  createdAt: string;
};

const FILTER_KINDS = [
  "all", "tool_call", "memory_event", "prompt_proposal",
  "subagent_spawn", "tool_gated", "tool_post_approval",
  "code_execution", "code_stdout", "code_stderr",
] as const;

export function AuditTrailFeed({ steps }: { steps: Step[] }) {
  const [filter, setFilter] = useState<typeof FILTER_KINDS[number]>("all");
  const visible = filter === "all" ? steps : steps.filter((s) => s.kind === filter);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTER_KINDS.map((k) => (
          <button key={k} type="button" onClick={() => setFilter(k)}
            className={
              "cursor-pointer rounded-full border px-2.5 py-0.5 text-[11px] font-medium " +
              (filter === k
                ? "border-[#0085CF] bg-[#0085CF] text-white"
                : "border-gray-200 bg-white text-gray-600")
            }>
            {k}
          </button>
        ))}
      </div>
      <ol className="divide-y rounded-lg border bg-white">
        {visible.map((s) => (
          <li key={s.id} className="px-3 py-2 font-mono text-xs text-gray-700">
            <span className="text-gray-400">{new Date(s.createdAt).toLocaleTimeString()}</span>
            {" · "}
            <span className="font-semibold">{s.kind}</span>
            {s.toolSlug ? <> · {s.toolSlug}</> : null}
            <pre className="mt-1 whitespace-pre-wrap font-mono text-[11px] text-gray-500">
              {JSON.stringify(s.payload, null, 2)}
            </pre>
          </li>
        ))}
        {visible.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-gray-500">No events for this filter.</li>
        ) : null}
      </ol>
    </div>
  );
}
