// components/store-builder/editable-section.tsx
"use client";

import { useState } from "react";
import { CheckCircle2, Edit3, History, Loader2, Sparkles } from "lucide-react";
import type { EditableSection as SectionT } from "@/lib/store-builder/types";

interface Props<T> {
  section: SectionT<T>;
  label?: string;
  renderView: (content: T) => React.ReactNode;
  renderEditor: (current: T, onChange: (next: T) => void) => React.ReactNode;
  onRegenerate: (userEdit: string) => Promise<void> | void;
  onSaveAsIs: (edited: T) => Promise<void> | void;
  onApprove: (versionId: string) => Promise<void> | void;
  onRevert?: (versionId: string) => Promise<void> | void;
}

export function EditableSection<T>({
  section, label, renderView, renderEditor,
  onRegenerate, onSaveAsIs, onApprove, onRevert,
}: Props<T>) {
  const active = section.versions.find((v) => v.id === section.activeVersionId);
  const initialContent = (active?.content ?? (undefined as unknown as T));

  const [mode, setMode] = useState<"view" | "edit">("view");
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [edited, setEdited] = useState<T>(initialContent);
  const [userEdit, setUserEdit] = useState("");

  if (!active) return <p className="text-sm text-red-600">Section has no active version</p>;

  const isApproved = !!section.approvedVersionId && section.approvedVersionId === section.activeVersionId;

  const handleRegenerate = async () => {
    setBusy(true);
    try { await onRegenerate(userEdit); setMode("view"); setUserEdit(""); }
    finally { setBusy(false); }
  };
  const handleSaveAsIs = async () => {
    setBusy(true);
    try { await onSaveAsIs(edited); setMode("view"); }
    finally { setBusy(false); }
  };
  const handleApprove = async () => {
    setBusy(true);
    try { await onApprove(section.activeVersionId); }
    finally { setBusy(false); }
  };

  const ago = (iso: string) => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };
  const versionLabel = `v${section.versions.findIndex((v) => v.id === section.activeVersionId) + 1} · ${active.author.toUpperCase()} · ${ago(active.createdAt)}`;

  return (
    <div className={`rounded-lg border ${isApproved ? "border-emerald-200 bg-emerald-50/40" : "border-gray-200 bg-white"} p-3 space-y-2`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {label && <p className="text-xs font-semibold text-gray-700">{label}</p>}
          <span className="text-xs text-gray-400">{versionLabel}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowHistory((s) => !s)}
            className="text-xs text-gray-500 hover:text-[#0085CF] flex items-center gap-1 cursor-pointer"
          >
            <History className="size-3" />
            {section.versions.length}
          </button>
          {mode === "view" && !isApproved && (
            <>
              <button onClick={() => setMode("edit")} className="text-xs text-[#0085CF] font-medium flex items-center gap-1 cursor-pointer">
                <Edit3 className="size-3" /> Edit
              </button>
              <button onClick={handleApprove} disabled={busy} className="text-xs bg-[#0085CF] text-white px-2.5 py-1 rounded hover:bg-[#006BA6] cursor-pointer flex items-center gap-1">
                {busy ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />} Approve
              </button>
            </>
          )}
          {isApproved && (
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded flex items-center gap-1">
              <CheckCircle2 className="size-3" /> Approved
            </span>
          )}
        </div>
      </div>

      {mode === "view" && renderView(active.content)}

      {mode === "edit" && (
        <div className="space-y-2">
          {renderEditor(edited, setEdited)}
          <textarea
            placeholder="Optional guidance for the AI (e.g. 'focus on Indian market only, drop references to US')"
            value={userEdit}
            onChange={(e) => setUserEdit(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-[#0085CF]/30"
          />
          <div className="flex items-center gap-2">
            <button onClick={handleRegenerate} disabled={busy} className="text-xs bg-[#0085CF] text-white px-3 py-1.5 rounded hover:bg-[#006BA6] cursor-pointer flex items-center gap-1">
              {busy ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />} Regenerate with this
            </button>
            <button onClick={handleSaveAsIs} disabled={busy} className="text-xs border border-gray-300 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
              Save as-is
            </button>
            <button onClick={() => setMode("view")} className="text-xs text-gray-500 hover:underline cursor-pointer">Cancel</button>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="border-t border-gray-100 pt-2 space-y-1">
          {section.versions.map((v, i) => (
            <div key={v.id} className={`text-xs flex items-center justify-between rounded px-2 py-1 ${v.id === section.activeVersionId ? "bg-[#0085CF]/5" : ""}`}>
              <span className="text-gray-600">v{i + 1} · {v.author.toUpperCase()} · {ago(v.createdAt)}</span>
              {onRevert && v.id !== section.activeVersionId && (
                <button onClick={() => onRevert(v.id)} className="text-[#0085CF] hover:underline cursor-pointer">Revert</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
