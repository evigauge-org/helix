// app/(authenticated)/settings/data-gov-in/page.tsx
"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, KeyRound, Save, Trash2 } from "lucide-react";

type KeyStatus = {
  hasKey: boolean;
  keyMask?: string;
  status?: "active" | "needs_rotation";
  rotatedAt?: string | null;
  lastUsedAt?: string | null;
  createdAt?: string;
};

export default function DataGovInSettingsPage() {
  const [info, setInfo] = useState<KeyStatus | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    const res = await fetch("/api/settings/data-gov-in/key");
    if (!res.ok) {
      setError(`Failed to load (${res.status})`);
      setInfo(null);
      return;
    }
    setInfo((await res.json()) as KeyStatus);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function save() {
    if (!draft.trim()) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/settings/data-gov-in/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: draft.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setDraft("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete your data.gov.in API key from Helix? You can paste it again later.")) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/settings/data-gov-in/key", { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
        <KeyRound className="size-5" /> data.gov.in API key
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        Required for Indian government data tools. Free to register.
      </p>

      <a
        href="https://data.gov.in/user/register"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1 rounded-full border border-[#0085CF]/30 px-3 py-1.5 text-xs text-[#0085CF] hover:bg-[#0085CF]/5"
      >
        Get a free key <ExternalLink className="size-3" />
      </a>

      {info?.status === "needs_rotation" && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Needs rotation</div>
            <p className="text-amber-700">
              data.gov.in returned 401 on the last call. Generate a new key on data.gov.in and replace this one below.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>
      )}

      <div className="mt-6 rounded-2xl border border-gray-200 p-5">
        {info?.hasKey ? (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-mono text-gray-900">{info.keyMask}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {info.status === "active" ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <CheckCircle2 className="size-3" /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-700">
                      <AlertTriangle className="size-3" /> Needs rotation
                    </span>
                  )}
                  {info.rotatedAt && <> · Rotated {new Date(info.rotatedAt).toLocaleString()}</>}
                  {info.lastUsedAt && <> · Last used {new Date(info.lastUsedAt).toLocaleString()}</>}
                </p>
              </div>
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="size-3" /> Delete
              </button>
            </div>
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-xs font-medium text-gray-700">Replace key</p>
              <div className="mt-2 flex gap-2">
                <input
                  type="password"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Paste new data.gov.in API key"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={save}
                  disabled={busy || !draft.trim()}
                  className="inline-flex items-center gap-1 rounded-md bg-[#0085CF] px-3 py-2 text-sm text-white hover:bg-[#0078b8] disabled:opacity-50"
                >
                  <Save className="size-4" /> Replace
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-700">No key on file. Paste yours below to enable Indian government data tools.</p>
            <div className="mt-3 flex gap-2">
              <input
                type="password"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Paste data.gov.in API key"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
              />
              <button
                type="button"
                onClick={save}
                disabled={busy || !draft.trim()}
                className="inline-flex items-center gap-1 rounded-md bg-[#0085CF] px-3 py-2 text-sm text-white hover:bg-[#0078b8] disabled:opacity-50"
              >
                <Save className="size-4" /> Save
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
