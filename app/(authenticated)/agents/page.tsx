"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Square, Trash2, Loader2, Plug } from "lucide-react";
import { RunTimeline } from "@/components/agents/run-timeline";
import { AgentsList } from "@/components/agents/agents-list";
import { ConstitutionPanel } from "@/components/agents/constitution-panel";
import { AgentDashboardTab } from "@/components/agents/agent-dashboard-tab";
import { AgentKnowledgeTab } from "@/components/agents/agent-knowledge-tab";
import { AgentReviewsTab } from "@/components/agents/agent-reviews-tab";
import { CreateAgentDialog } from "@/components/agents/create-agent-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type AgentSummary = {
  id: string;
  name: string;
  goal: string;
  runs: Array<{ id: string; status: string; startedAt: string; nextWakeAt: string | null }>;
  updatedAt: string;
};

function AgentsPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(params.get("selected"));
  const [tab, setTab] = useState<"timeline" | "dashboard" | "knowledge" | "reviews">("timeline");
  const [stopBusy, setStopBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  async function refreshAgents() {
    const res = await fetch("/api/agents");
    if (res.ok) {
      const { agents } = await res.json();
      setAgents(agents);
    }
  }

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const { agents } = await res.json();
        setAgents(agents);
        if (!selectedId && agents.length) setSelectedId(agents[0].id);
      }
    })();
  }, [selectedId]);

  const selected = useMemo(() => agents.find((a) => a.id === selectedId) ?? null, [agents, selectedId]);
  const latestRunId = selected?.runs?.[0]?.id ?? null;
  const latestStatus = selected?.runs?.[0]?.status ?? null;
  const isStoppable = latestStatus !== null && !["completed", "stopped", "expired", "aborted"].includes(latestStatus);

  async function handleStop() {
    if (!selected) return;
    setStopBusy(true);
    try {
      await fetch(`/api/agents/${selected.id}/stop`, { method: "POST" });
      await refreshAgents();
    } finally {
      setStopBusy(false);
    }
  }

  async function confirmDelete() {
    if (!selected) return;
    setDeleteBusy(true);
    try {
      await fetch(`/api/agents/${selected.id}/delete`, { method: "POST" });
      setSelectedId(null);
      router.replace("/agents");
      await refreshAgents();
    } finally {
      setDeleteBusy(false);
      setDeleteOpen(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside className="w-[260px] shrink-0 border-r border-gray-200 bg-white">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-sm font-semibold text-gray-900">Agents</h2>
          <div className="flex items-center gap-1.5">
            <Link
              href="/agents/templates"
              className="rounded-full border border-[#0085CF]/30 bg-white px-2.5 py-1 text-xs text-[#0085CF] hover:bg-[#0085CF]/5 cursor-pointer"
            >
              Templates
            </Link>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1 rounded-full bg-[#0085CF] px-2.5 py-1 text-xs text-white hover:bg-[#0070b3] cursor-pointer"
            >
              <Plus className="size-3" /> New
            </button>
          </div>
        </div>
        <AgentsList agents={agents} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); router.replace(`/agents?selected=${id}`); }} />
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto bg-white p-6">
        {selected ? (
          <>
            <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <h1 className="text-xl font-semibold text-gray-900 truncate">{selected.name}</h1>
                <p className="text-xs text-gray-500 truncate">{selected.goal}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/agents/${selected.id}/mcp-servers`}
                  title="Attach external MCP servers to expand this agent's tools"
                  className="flex items-center gap-1.5 rounded-full border border-[#0085CF]/30 bg-[#0085CF]/10 px-3 py-1.5 text-xs font-medium text-[#0085CF] hover:bg-[#0085CF]/20 cursor-pointer"
                >
                  <Plug className="size-3.5" />
                  MCP Servers
                </Link>
                <button
                  onClick={handleStop}
                  disabled={stopBusy || !isStoppable}
                  title={isStoppable ? "Stop this agent and all descendants" : "Already terminal — nothing to stop"}
                  className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {stopBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Square className="size-3.5" />}
                  Stop
                </button>
                <button
                  onClick={() => setDeleteOpen(true)}
                  disabled={deleteBusy}
                  title="Permanently delete this agent and its entire subtree"
                  className="flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {deleteBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  Delete
                </button>
              </div>
            </div>
            <div className="mb-4 flex gap-1 border-b border-gray-200">
              <button
                onClick={() => setTab("timeline")}
                className={
                  "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px cursor-pointer " +
                  (tab === "timeline"
                    ? "border-[#0085CF] text-[#0085CF]"
                    : "border-transparent text-gray-500 hover:text-gray-800")
                }
              >
                Run Timeline
              </button>
              <button
                onClick={() => setTab("dashboard")}
                className={
                  "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px cursor-pointer " +
                  (tab === "dashboard"
                    ? "border-[#0085CF] text-[#0085CF]"
                    : "border-transparent text-gray-500 hover:text-gray-800")
                }
              >
                Dashboard
              </button>
              <button
                onClick={() => setTab("knowledge")}
                className={
                  "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px cursor-pointer " +
                  (tab === "knowledge"
                    ? "border-[#0085CF] text-[#0085CF]"
                    : "border-transparent text-gray-500 hover:text-gray-800")
                }
              >
                Knowledge
              </button>
              <button
                onClick={() => setTab("reviews")}
                className={
                  "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px cursor-pointer " +
                  (tab === "reviews"
                    ? "border-[#0085CF] text-[#0085CF]"
                    : "border-transparent text-gray-500 hover:text-gray-800")
                }
              >
                Reviews
              </button>
            </div>
            {tab === "timeline" ? (
              <RunTimeline runId={latestRunId} />
            ) : tab === "dashboard" ? (
              <AgentDashboardTab agentId={selected.id} />
            ) : tab === "knowledge" ? (
              <AgentKnowledgeTab agentId={selected.id} />
            ) : (
              <AgentReviewsTab agentId={selected.id} />
            )}
          </>
        ) : (
          <p className="text-gray-500">Create an agent to get started. Try typing &quot;create an agent that ...&quot; in chat, or use the New button.</p>
        )}
      </main>

      <aside className="w-[320px] shrink-0 border-l border-gray-200 bg-white p-4">
        <ConstitutionPanel />
      </aside>

      <CreateAgentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(agentId) => {
          setCreateOpen(false);
          refreshAgents();
          setSelectedId(agentId);
          router.replace(`/agents?selected=${agentId}`);
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={(open) => !deleteBusy && setDeleteOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete agent{selected ? ` "${selected.name}"` : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently wipes the agent, every descendant, all runs, steps, artifacts,
              modifications, versions, messages, and skills. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleteBusy}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteBusy ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Deleting…
                </>
              ) : (
                "Delete permanently"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function AgentsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-gray-500">Loading…</p>}>
      <AgentsPageInner />
    </Suspense>
  );
}
