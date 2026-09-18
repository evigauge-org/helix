"use client";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

type Agent = { id: string; name: string; runs: { status: string; nextWakeAt: string | null }[] };

export function AgentsList({ agents, selectedId, onSelect }: { agents: Agent[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <ul className="space-y-1 px-2 pb-4">
      {agents.map((a) => {
        const latest = a.runs?.[0];
        return (
          <li key={a.id}>
            <button
              onClick={() => onSelect(a.id)}
              className={cn(
                "w-full rounded-md p-2 text-left transition-colors cursor-pointer",
                selectedId === a.id ? "bg-[#0085CF]/10 text-[#0085CF]" : "text-gray-800 hover:bg-gray-50",
              )}
            >
              <div className="text-sm font-medium">{a.name}</div>
              <div className="text-[11px] text-gray-500">
                {latest ? latest.status : "no runs"}
                {latest?.status === "idle" && latest.nextWakeAt
                  ? ` · wakes ${formatDistanceToNow(new Date(latest.nextWakeAt), { addSuffix: true })}`
                  : null}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
