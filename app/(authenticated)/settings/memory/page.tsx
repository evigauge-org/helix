"use client";

import { useEffect, useState } from "react";
import { Trash2, PauseCircle, PlayCircle, Loader2 } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
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

type Fact = { id: string; fact: string; category: string; confidence: number };

export default function MemorySettingsPage() {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const memoryPaused = useUIStore((s) => s.memoryPaused);
  const setMemoryPaused = useUIStore((s) => s.setMemoryPaused);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/memory/facts");
    const data = await res.json();
    setFacts(data.facts ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    await fetch(`/api/memory/facts?id=${id}`, { method: "DELETE" });
    load();
  };
  const confirmClearAll = async () => {
    setClearBusy(true);
    try {
      await fetch("/api/memory/facts?all=true", { method: "DELETE" });
      await load();
    } finally {
      setClearBusy(false);
      setClearOpen(false);
    }
  };

  const grouped = facts.reduce<Record<string, Fact[]>>((acc, f) => {
    (acc[f.category] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold text-gray-900">Memory</h1>
      <p className="mt-1 text-sm text-gray-500">
        What Helix remembers about you across conversations.
      </p>

      <div className="mt-6 flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <p className="font-medium text-gray-900">Pause memory</p>
          <p className="text-xs text-gray-500">Temporarily stop using memory facts in responses.</p>
        </div>
        <button
          onClick={() => setMemoryPaused(!memoryPaused)}
          className="flex items-center gap-2 rounded-full border border-[#0085CF]/30 bg-white px-3 py-1.5 text-sm text-[#0085CF] hover:bg-[#0085CF]/5 cursor-pointer"
        >
          {memoryPaused ? <PlayCircle className="size-4" /> : <PauseCircle className="size-4" />}
          {memoryPaused ? "Resume" : "Pause"}
        </button>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900">Facts ({facts.length})</h2>
        {facts.length > 0 && (
          <button onClick={() => setClearOpen(true)} className="text-xs text-red-600 hover:underline cursor-pointer">
            Clear all
          </button>
        )}
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Loading…</p>
      ) : facts.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No memories yet. Keep chatting — Helix will learn.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {Object.entries(grouped).map(([cat, rows]) => (
            <div key={cat} className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-100 px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                {cat}
              </div>
              <ul>
                {rows.map((f) => (
                  <li key={f.id} className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-800">{f.fact}</span>
                    <button onClick={() => remove(f.id)} className="text-gray-400 hover:text-red-600 cursor-pointer">
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={clearOpen} onOpenChange={(open) => !clearBusy && setClearOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all memory facts?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes everything Helix has learned about you across conversations.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmClearAll();
              }}
              disabled={clearBusy}
              className="bg-red-600 hover:bg-red-700"
            >
              {clearBusy ? <><Loader2 className="mr-2 size-4 animate-spin" /> Clearing…</> : "Clear all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
