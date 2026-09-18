"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function AgentDashboardTab({ agentId }: { agentId: string }) {
  const [meta, setMeta] = useState<{ updatedAt: string; title: string } | null>(null);
  const [missing, setMissing] = useState(false);
  const stoppedRef = useRef(false);

  useEffect(() => {
    stoppedRef.current = false;
    async function poll() {
      if (stoppedRef.current) return;
      if (typeof document !== "undefined" && document.hidden) {
        setTimeout(poll, 3000);
        return;
      }
      try {
        const res = await fetch(`/api/agent-dashboards/${agentId}/meta`);
        if (res.status === 404) {
          setMissing(true);
        } else if (res.ok) {
          const json = (await res.json()) as { updatedAt: string; title: string };
          setMissing(false);
          setMeta(json);
        }
      } catch {
        // swallow
      }
      setTimeout(poll, 3000);
    }
    poll();
    return () => {
      stoppedRef.current = true;
    };
  }, [agentId]);

  if (missing && !meta) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-500">
          This agent hasn&apos;t published a dashboard yet. Ask it in chat or wait for the next tick.
        </p>
      </div>
    );
  }

  if (!meta) {
    return <p className="text-sm text-gray-500">Loading dashboard…</p>;
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-lg font-semibold text-gray-900">{meta.title}</h2>
        <span className="text-xs text-gray-500">
          updated {formatDistanceToNow(new Date(meta.updatedAt), { addSuffix: true })}
        </span>
        <a
          href={`/api/agent-dashboards/${agentId}/render`}
          target="_blank"
          rel="noreferrer"
          className="ml-auto flex items-center gap-1 text-xs text-[#0085CF] hover:underline"
        >
          <ExternalLink className="size-3" /> Open in new tab
        </a>
      </div>
      <iframe
        key={meta.updatedAt}
        src={`/api/agent-dashboards/${agentId}/render`}
        sandbox="allow-scripts allow-same-origin"
        className="w-full h-[calc(100vh-220px)] border-0 rounded-xl bg-white shadow-sm"
        title={`${meta.title} dashboard`}
      />
    </div>
  );
}
