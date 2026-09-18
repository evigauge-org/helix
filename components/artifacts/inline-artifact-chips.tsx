"use client";

import { useEffect, useState } from "react";
import { ArtifactChip, type ArtifactLite } from "./artifact-chip";
import { Paperclip } from "lucide-react";

interface Props {
  runId: string;
}

interface ApiResponse {
  artifacts: Array<{
    id: string;
    name: string;
    mimeType: string;
    createdAt: string;
    runId: string;
    agentId: string;
    agentName: string;
  }>;
}

export function InlineArtifactChips({ runId }: Props) {
  const [items, setItems] = useState<ArtifactLite[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/agent-runs/${runId}`);
        if (!res.ok) return;
        const data = (await res.json()) as { run?: { artifacts?: ApiResponse["artifacts"] } };
        const list = data.run?.artifacts ?? [];
        if (!cancelled) {
          setItems(list.map((a) => ({ id: a.id, name: a.name, mimeType: a.mimeType })));
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [runId]);

  if (!items || items.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1 rounded-lg border border-[#0085CF]/10 bg-[#0085CF]/[0.03] px-3 py-2">
      <span className="mr-1 inline-flex items-center gap-1 text-xs font-medium text-gray-600">
        <Paperclip className="size-3" /> Attached files:
      </span>
      {items.map((a) => (
        <ArtifactChip key={a.id} id={a.id} name={a.name} mimeType={a.mimeType} />
      ))}
    </div>
  );
}
