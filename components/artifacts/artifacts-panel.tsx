"use client";

import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useUIStore } from "@/stores/ui-store";
import { useChatStore } from "@/stores/chat-store";
import {
  FileText, Download, Loader2, Search, Eye,
  FileSpreadsheet, Presentation, BookOpen, FileCode, Paperclip,
} from "lucide-react";

interface ArtifactRow {
  id: string;
  name: string;
  mimeType: string;
  createdAt: string;
  runId: string;
  agentId: string;
  agentName: string;
}

type FilterKey = "all" | "doc" | "sheet" | "deck" | "md" | "pdf" | "other";

function extFromName(name: string): string {
  const m = /\.([^.]+)$/.exec(name);
  return m ? m[1].toLowerCase() : "";
}

function iconFor(ext: string) {
  if (ext === "xlsx" || ext === "xls" || ext === "csv") return FileSpreadsheet;
  if (ext === "pptx" || ext === "ppt") return Presentation;
  if (ext === "md") return BookOpen;
  if (ext === "json" || ext === "html" || ext === "xml") return FileCode;
  return FileText;
}

function previewTypeHint(ext: string): string {
  if (ext === "md" || ext === "markdown") return "md";
  if (ext === "xlsx" || ext === "xls") return "xlsx";
  if (ext === "docx" || ext === "doc") return "docx";
  if (ext === "pptx" || ext === "ppt") return "pptx";
  if (ext === "pdf") return "pdf";
  if (ext === "csv") return "csv";
  return "txt";
}

function categoryFor(ext: string): FilterKey {
  if (ext === "docx" || ext === "doc") return "doc";
  if (ext === "xlsx" || ext === "xls" || ext === "csv") return "sheet";
  if (ext === "pptx" || ext === "ppt") return "deck";
  if (ext === "md" || ext === "markdown") return "md";
  if (ext === "pdf") return "pdf";
  return "other";
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "doc", label: "DOCX" },
  { key: "md", label: "MD" },
  { key: "deck", label: "PPTX" },
  { key: "sheet", label: "Sheets" },
  { key: "pdf", label: "PDF" },
  { key: "other", label: "Other" },
];

export function ArtifactsPanel() {
  const isOpen = useUIStore((s) => s.artifactsPanelOpen);
  const close = useUIStore((s) => s.closeArtifactsPanel);
  const openPreview = useUIStore((s) => s.openArtifactPreview);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const messages = useChatStore((s) => s.messages);

  const [items, setItems] = useState<ArtifactRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen || !activeSessionId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/chat-artifacts/${activeSessionId}`);
        if (!res.ok) {
          if (!cancelled) setError(`Failed to load (${res.status})`);
          return;
        }
        const data = (await res.json()) as { artifacts: ArtifactRow[] };
        if (!cancelled) setItems(data.artifacts ?? []);
      } catch {
        if (!cancelled) setError("Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // Re-fetch when message count changes too (new agent post may have added artifacts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeSessionId, messages.length]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((a) => {
      const ext = extFromName(a.name);
      if (filter !== "all" && categoryFor(ext) !== filter) return false;
      if (q && !a.name.toLowerCase().includes(q) && !a.agentName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, filter, search]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) close(); }}>
      <SheetContent
        side="right"
        className="bg-white border-l border-[#0085CF]/15 p-0 flex flex-col"
        style={{
          width: "clamp(420px, 30vw, 640px)",
          maxWidth: "min(90vw, 640px)",
        }}
      >
        <SheetHeader className="border-b border-[#0085CF]/10 bg-[#0085CF]/5 px-5 py-4 shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base font-semibold">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#0085CF]/10">
              <Paperclip className="size-4 text-[#0085CF]" />
            </div>
            <span className="flex-1 text-gray-800">Artifacts</span>
            <span className="rounded-full bg-[#0085CF]/10 px-2 py-0.5 text-xs font-medium text-[#0085CF]">
              {items.length}
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 py-3 border-b border-gray-100 shrink-0 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search files or agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-gray-200 bg-white pl-8 pr-2.5 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0085CF]/30"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={
                  "rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors " +
                  (filter === f.key
                    ? "bg-[#0085CF] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200")
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 text-[#0085CF] animate-spin" />
            </div>
          )}

          {error && !loading && (
            <div className="px-5 py-8 text-center text-sm text-red-600">{error}</div>
          )}

          {!loading && !error && !activeSessionId && (
            <div className="px-5 py-8 text-center text-sm text-gray-500">
              Start a chat to see artifacts here.
            </div>
          )}

          {!loading && !error && activeSessionId && filtered.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-gray-500">
              {items.length === 0
                ? "No artifacts produced by agents in this chat yet."
                : "No files match the current filter."}
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {filtered.map((a) => {
                const ext = extFromName(a.name);
                const Icon = iconFor(ext);
                const downloadUrl = `/api/agent-artifacts/${a.id}/download`;
                return (
                  <li key={a.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#0085CF]/10">
                        <Icon className="size-4 text-[#0085CF]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-800">{a.name}</p>
                        <p className="truncate text-xs text-gray-500">
                          {a.agentName} · {formatWhen(a.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            openPreview({ url: downloadUrl, title: a.name, type: previewTypeHint(ext) })
                          }
                          className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 cursor-pointer"
                          title="Preview"
                        >
                          <Eye className="size-3" /> Preview
                        </button>
                        <a
                          href={downloadUrl}
                          download={a.name}
                          className="flex items-center gap-1 rounded-md bg-[#0085CF] px-2 py-1 text-xs font-medium text-white hover:bg-[#006BA6] cursor-pointer"
                          title="Download"
                        >
                          <Download className="size-3" />
                        </a>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
