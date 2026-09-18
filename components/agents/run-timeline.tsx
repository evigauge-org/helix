"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { StepItem } from "./step-item";

type Step = { id: string; kind: string; toolSlug?: string | null; payload: unknown; tickNumber: number; stepNumber: number; createdAt: string };
type Run = {
  id: string; status: string; tickCount: number; totalSteps: number; totalTokens: number;
  nextWakeAt: string | null; finalMessage: string | null;
  artifacts: Array<{ id: string; name: string; mimeType: string }>;
  agent: { name: string };
};

const TERMINAL = new Set(["completed", "stopped", "expired", "aborted"]);

export function RunTimeline({ runId }: { runId: string | null }) {
  const [run, setRun] = useState<Run | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const lastStepIdRef = useRef<string | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!runId) return;
    stoppedRef.current = false;
    lastStepIdRef.current = null;
    setSteps([]);
    setRun(null);

    async function tick() {
      if (stoppedRef.current) return;
      if (typeof document !== "undefined" && document.hidden) {
        setTimeout(tick, 1500);
        return;
      }
      const url = `/api/agent-runs/${runId}${lastStepIdRef.current ? `?since=${lastStepIdRef.current}` : ""}`;
      try {
        const res = await fetch(url);
        if (res.ok) {
          const { run: r, newSteps } = await res.json();
          setRun(r);
          if (newSteps?.length) {
            setSteps((prev) => [...prev, ...newSteps]);
            lastStepIdRef.current = newSteps[newSteps.length - 1].id;
          }
          if (TERMINAL.has(r.status)) return;
        }
      } catch { /* ignore */ }
      setTimeout(tick, 1500);
    }
    tick();
    return () => { stoppedRef.current = true; };
  }, [runId]);

  if (!runId) return <p className="text-sm text-gray-500">No runs yet.</p>;
  if (!run) return <p className="text-sm text-gray-500">Loading...</p>;

  async function stop() { await fetch(`/api/agent-runs/${runId}/stop`, { method: "POST" }); }
  async function wake() { await fetch(`/api/agent-runs/${runId}/wake`, { method: "POST" }); }

  const grouped = steps.reduce<Record<number, Step[]>>((acc, s) => {
    (acc[s.tickNumber] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-semibold text-gray-900">{run.agent.name}</h2>
        <span className={cn(
          "rounded-full px-2.5 py-1 text-xs font-medium",
          run.status === "active" ? "bg-green-100 text-green-700" :
          run.status === "idle" ? "bg-yellow-100 text-yellow-700" :
          run.status === "completed" ? "bg-blue-100 text-blue-700" :
          "bg-gray-100 text-gray-700",
        )}>{run.status}</span>
        <span className="text-xs text-gray-500">tick {run.tickCount} · {run.totalSteps} steps · {run.totalTokens} tokens</span>
        {run.status === "idle" && (
          <button
            onClick={wake}
            className="flex items-center gap-1 rounded-full border border-[#0085CF]/30 bg-[#0085CF]/5 px-3 py-1 text-xs font-medium text-[#0085CF] hover:bg-[#0085CF]/10 hover:border-[#0085CF]/50 cursor-pointer"
          >
            Wake Now
          </button>
        )}
        {["active", "idle", "pending"].includes(run.status) && (
          <button onClick={stop} className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-600 hover:bg-red-100 cursor-pointer">Stop</button>
        )}
      </div>

      {Object.entries(grouped).map(([tick, arr]) => (
        <details key={tick} open className="group mb-3 rounded-md border border-gray-200">
          <summary className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 list-none [&::-webkit-details-marker]:hidden select-none rounded-md">
            <ChevronRight className="size-3.5 text-gray-500 transition-transform group-open:rotate-90" />
            <span>Tick {tick} — {arr.length} step(s)</span>
            <span className="ml-auto text-[10px] uppercase tracking-wider text-gray-400 group-open:hidden">Click to expand</span>
            <span className="ml-auto text-[10px] uppercase tracking-wider text-gray-400 hidden group-open:inline">Click to collapse</span>
          </summary>
          <ul className="space-y-2 p-3">
            {arr.map((step) => (
              <li key={step.id}>
                <StepItem step={step} />
              </li>
            ))}
          </ul>
        </details>
      ))}

      {run.artifacts.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-medium">Artifacts</h3>
          <ul className="space-y-1">
            {run.artifacts.map((a) => (
              <li key={a.id} className="text-sm">
                <a href={`/api/agent-artifacts/${a.id}/download`} className="text-[#0085CF] hover:underline">{a.name}</a>
                <span className="ml-2 text-xs text-gray-500">{a.mimeType}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
