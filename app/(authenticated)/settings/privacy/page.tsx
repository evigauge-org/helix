"use client";

import { useEffect, useState } from "react";
import { Eye, Download, ShieldOff, Loader2, Plus, Lock, FileText } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

type Subject = {
  id: string;
  subject_id: string;
  metadata: Record<string, unknown>;
  legal_hold: boolean;
  created_at: string;
};

type Manifest = {
  subject_id: string;
  mode: "redact" | "hard_delete";
  deleted: Array<{ kind: string; id: string; aepId?: string | null }>;
  redacted: Array<{ kind: string; id: string; aepId?: string | null }>;
  stripped: Array<{ kind: string; id: string; aepId?: string | null }>;
  retained: Array<{ kind: string; id: string; aepId?: string | null; reason?: string }>;
  performed_at: string;
};

const SWITCH_PIN = "data-checked:bg-[#0085CF] data-unchecked:bg-gray-200";

export default function PrivacyPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  // Create
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newAepId, setNewAepId] = useState("");
  const [newMetadata, setNewMetadata] = useState("");
  const [newLegalHold, setNewLegalHold] = useState(false);

  // Read modal
  const [readSubject, setReadSubject] = useState<Subject | null>(null);
  const [readSnapshot, setReadSnapshot] = useState<unknown>(null);
  const [readBusy, setReadBusy] = useState(false);

  // Erase modal
  const [eraseSubject, setEraseSubject] = useState<Subject | null>(null);
  const [eraseMode, setEraseMode] = useState<"redact" | "hard_delete">("redact");
  const [eraseBusy, setEraseBusy] = useState(false);
  const [eraseManifest, setEraseManifest] = useState<Manifest | null>(null);
  const [eraseError, setEraseError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/subjects", { credentials: "include" });
      if (res.ok) setSubjects(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetCreate = () => {
    setNewAepId("");
    setNewMetadata("");
    setNewLegalHold(false);
    setCreateError(null);
  };

  const handleCreate = async () => {
    setCreateBusy(true);
    setCreateError(null);
    try {
      let metadataObj: Record<string, unknown> | undefined;
      if (newMetadata.trim()) {
        try {
          metadataObj = JSON.parse(newMetadata);
        } catch {
          setCreateError("Metadata must be valid JSON.");
          return;
        }
      }
      const res = await fetch("/api/me/subjects", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aepId: newAepId.trim() || undefined,
          metadata: metadataObj,
          legalHold: newLegalHold,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setCreateError(err?.error ?? `Create failed (${res.status})`);
        return;
      }
      setCreateOpen(false);
      resetCreate();
      await load();
    } finally {
      setCreateBusy(false);
    }
  };

  const handleRead = async (s: Subject) => {
    setReadSubject(s);
    setReadSnapshot(null);
    setReadBusy(true);
    try {
      const res = await fetch(`/api/me/subjects/${s.subject_id}`, { credentials: "include" });
      if (res.ok) setReadSnapshot(await res.json());
    } finally {
      setReadBusy(false);
    }
  };

  const handleExport = (s: Subject) => {
    window.location.href = `/api/me/subjects/${s.subject_id}/export`;
  };

  const handleErase = async () => {
    if (!eraseSubject) return;
    setEraseBusy(true);
    setEraseError(null);
    try {
      const res = await fetch(`/api/me/subjects/${eraseSubject.subject_id}/erase`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: eraseMode }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setEraseError(err?.error ?? `Erase failed (${res.status})`);
        return;
      }
      const manifest = (await res.json()) as Manifest;
      setEraseManifest(manifest);
      await load();
    } finally {
      setEraseBusy(false);
    }
  };

  const closeEraseModal = () => {
    setEraseSubject(null);
    setEraseManifest(null);
    setEraseMode("redact");
    setEraseError(null);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Privacy & DSAR</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage subjects (natural persons whose data your agents may process). Each subject has GDPR
            rights — Read, Export, and Erase — that you can exercise from this page on their behalf.
          </p>
        </div>
        <Button
          onClick={() => {
            resetCreate();
            setCreateOpen(true);
          }}
          className="bg-[#0085CF] text-white hover:bg-[#0085CF]/90"
        >
          <Plus className="size-4" />
          New Subject
        </Button>
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-gray-500">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : subjects.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <FileText className="size-8 text-gray-300" />
            <p className="text-sm text-gray-500">
              No subjects yet. Create one to start tracking GDPR data for a natural person.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {subjects.map((s) => (
              <div key={s.id} className="flex items-start gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <code className="truncate font-mono text-sm font-medium text-gray-900">{s.subject_id}</code>
                    {s.legal_hold && (
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs">
                        <Lock className="size-3" /> legal hold
                      </Badge>
                    )}
                  </div>
                  {Object.keys(s.metadata).length > 0 && (
                    <pre className="mt-2 max-h-24 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-700">
                      {JSON.stringify(s.metadata, null, 2)}
                    </pre>
                  )}
                  <p className="mt-2 text-xs text-gray-400">
                    Created {new Date(s.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRead(s)}
                    className="text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                  >
                    <Eye className="size-4" /> Read
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleExport(s)}
                    className="text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                  >
                    <Download className="size-4" /> Export
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEraseSubject(s);
                      setEraseMode("redact");
                      setEraseManifest(null);
                      setEraseError(null);
                    }}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <ShieldOff className="size-4" /> Erase
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-white text-gray-900 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-gray-900">New Subject</DialogTitle>
            <DialogDescription className="text-gray-500">
              Create a Subject row to track GDPR rights for a natural person. Records (agents, runs,
              artifacts, memory, messages) tagged with this subject&apos;s id become walkable via Read /
              Export / Erase.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subj-id">Subject ID (optional)</Label>
              <Input
                id="subj-id"
                placeholder="sub_… (auto-generated if blank)"
                value={newAepId}
                onChange={(e) => setNewAepId(e.target.value)}
                disabled={createBusy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subj-meta">Metadata (JSON)</Label>
              <textarea
                id="subj-meta"
                placeholder='{ "name": "Alice", "email": "alice@example.com" }'
                value={newMetadata}
                onChange={(e) => setNewMetadata(e.target.value)}
                disabled={createBusy}
                rows={4}
                className="w-full rounded-md border border-gray-300 bg-white p-2 font-mono text-xs text-gray-900"
              />
              <p className="text-xs text-gray-500">Free-form JSON. Stored verbatim.</p>
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <Label htmlFor="legal-hold" className="font-medium text-amber-900">Legal hold</Label>
                  <p className="mt-1 text-xs text-amber-800/80">
                    When on, future erase calls return all records as <code>retained</code> instead of
                    deleting/redacting. Use for active litigation.
                  </p>
                </div>
                <Switch
                  id="legal-hold"
                  checked={newLegalHold}
                  onCheckedChange={setNewLegalHold}
                  disabled={createBusy}
                  className={SWITCH_PIN}
                />
              </div>
            </div>
            {createError && <p className="text-xs text-red-600">{createError}</p>}
          </div>
          <DialogFooter className="bg-gray-50 border-gray-200">
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={createBusy}
              className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createBusy}
              className="bg-[#0085CF] text-white hover:bg-[#0085CF]/90"
            >
              {createBusy && <Loader2 className="size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Read modal */}
      <Dialog open={readSubject !== null} onOpenChange={(open) => !open && setReadSubject(null)}>
        <DialogContent className="bg-white text-gray-900 sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Subject snapshot</DialogTitle>
            <DialogDescription className="text-gray-500">
              {readSubject?.subject_id} — DSAR-style read of all tagged records (artifact content
              truncated; use Export for full bytes).
            </DialogDescription>
          </DialogHeader>
          {readBusy ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-gray-500">
              <Loader2 className="size-4 animate-spin" /> Walking records…
            </div>
          ) : (
            <pre className="max-h-[60vh] overflow-auto rounded-md bg-gray-50 p-3 font-mono text-xs text-gray-900">
              {JSON.stringify(readSnapshot, null, 2)}
            </pre>
          )}
          <DialogFooter className="bg-gray-50 border-gray-200">
            <Button onClick={() => setReadSubject(null)} className="bg-[#0085CF] text-white hover:bg-[#0085CF]/90">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Erase confirm + manifest */}
      <AlertDialog open={eraseSubject !== null} onOpenChange={(open) => !open && closeEraseModal()}>
        <AlertDialogContent className="bg-white text-gray-900 sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900">
              {eraseManifest ? "Erasure complete" : "Erase subject data?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500">
              {eraseManifest ? (
                <>
                  Wrote audit log row for <code>{eraseSubject?.subject_id}</code>, mode{" "}
                  <code>{eraseManifest.mode}</code>.
                </>
              ) : (
                <>
                  This will walk all records tagged with <code>{eraseSubject?.subject_id}</code> and apply
                  the chosen mode. Multi-subject Agents/Runs are stripped from list (preserves other
                  subjects). Subject.legal_hold short-circuits to &quot;retained.&quot;
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {!eraseManifest && (
            <div className="space-y-3">
              <div className="rounded-md border border-gray-200 p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="erase-mode"
                    checked={eraseMode === "redact"}
                    onChange={() => setEraseMode("redact")}
                    disabled={eraseBusy}
                  />
                  <span className="font-medium text-gray-900">Redact (default)</span>
                </label>
                <p className="ml-6 mt-1 text-xs text-gray-500">
                  Replaces PII text fields with <code>[REDACTED]</code>. Preserves row IDs and audit
                  trails.
                </p>
              </div>
              <div className="rounded-md border border-red-200 bg-red-50/30 p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="erase-mode"
                    checked={eraseMode === "hard_delete"}
                    onChange={() => setEraseMode("hard_delete")}
                    disabled={eraseBusy}
                  />
                  <span className="font-medium text-red-900">Hard delete</span>
                </label>
                <p className="ml-6 mt-1 text-xs text-red-800/80">
                  Deletes single-subject runs/artifacts/memory/messages outright. Agents stay (their
                  PII fields are redacted) — they may have other subjects&apos; children.
                </p>
              </div>
              {eraseError && <p className="text-xs text-red-600">{eraseError}</p>}
            </div>
          )}

          {eraseManifest && (
            <div className="space-y-3 text-sm">
              <ManifestSection title="Deleted" entries={eraseManifest.deleted} variant="red" />
              <ManifestSection title="Redacted" entries={eraseManifest.redacted} variant="amber" />
              <ManifestSection title="Stripped (multi-subject)" entries={eraseManifest.stripped} variant="blue" />
              <ManifestSection title="Retained (legal hold / policy)" entries={eraseManifest.retained} variant="gray" />
              <p className="text-xs text-gray-400">
                Performed at {new Date(eraseManifest.performed_at).toLocaleString()}
              </p>
            </div>
          )}

          <AlertDialogFooter className="bg-gray-50 border-gray-200">
            {!eraseManifest ? (
              <>
                <AlertDialogCancel
                  disabled={eraseBusy}
                  className="bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleErase}
                  disabled={eraseBusy}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {eraseBusy && <Loader2 className="size-4 animate-spin" />}
                  Run erasure
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction
                onClick={closeEraseModal}
                className="bg-[#0085CF] hover:bg-[#0085CF]/90"
              >
                Done
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ManifestSection({
  title,
  entries,
  variant,
}: {
  title: string;
  entries: Array<{ kind: string; id: string; aepId?: string | null; reason?: string }>;
  variant: "red" | "amber" | "blue" | "gray";
}) {
  if (entries.length === 0) return null;
  const variants = {
    red: "border-red-200 bg-red-50/30 text-red-900",
    amber: "border-amber-200 bg-amber-50/30 text-amber-900",
    blue: "border-[#0085CF]/30 bg-[#0085CF]/5 text-[#0085CF]",
    gray: "border-gray-200 bg-gray-50 text-gray-700",
  };
  return (
    <div className={`rounded-md border p-3 ${variants[variant]}`}>
      <p className="font-medium">
        {title} <span className="opacity-60">({entries.length})</span>
      </p>
      <ul className="mt-1 max-h-24 overflow-auto font-mono text-xs">
        {entries.map((e, i) => (
          <li key={`${e.kind}-${e.id}-${i}`}>
            {e.kind}: {e.aepId ?? e.id}
            {e.reason && ` (${e.reason})`}
          </li>
        ))}
      </ul>
    </div>
  );
}
