"use client";

import { useEffect, useRef, useState } from "react";
import { Table2, Loader2, ExternalLink, AlertCircle, Check } from "lucide-react";

type Status = "idle" | "generating" | "done" | "error";

interface Props {
  topic: string;
  sourceText?: string;
  /**
   * When true (default), fire the sheet creation on mount automatically
   * so the user doesn't need to click. Intent detector passes this for
   * explicit commands like "put this in a sheet".
   */
  autoFire?: boolean;
}

export function SheetCard({ topic, sourceText, autoFire = true }: Props) {
  const [status, setStatus] = useState<Status>(autoFire ? "generating" : "idle");
  const [result, setResult] = useState<{ url: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const fire = async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setStatus("generating");
    setError(null);
    try {
      const res = await fetch("/api/chat-sheets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, sourceText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Sheet creation failed (${res.status})`);
        setStatus("error");
        return;
      }
      setResult({ url: data.url, title: data.title ?? "Sheet" });
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setStatus("error");
    }
  };

  useEffect(() => {
    if (autoFire && !startedRef.current) fire();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFire]);

  return (
    <div className="my-4 rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100">
          <Table2 className="size-5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800">Google Sheet</p>
          <p className="text-xs text-gray-500 truncate">{topic}</p>
        </div>
      </div>

      {status === "idle" && (
        <button
          onClick={fire}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors cursor-pointer"
        >
          Create Sheet
        </button>
      )}

      {status === "generating" && (
        <div className="flex items-center justify-center gap-2 py-3 text-sm text-emerald-700">
          <Loader2 className="size-4 animate-spin" />
          Building a formatted Google Sheet from the conversation...
        </div>
      )}

      {status === "done" && result && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <div className="flex items-center gap-2 text-sm text-emerald-800 min-w-0">
            <Check className="size-4 shrink-0" />
            <span className="truncate font-medium">{result.title}</span>
          </div>
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors cursor-pointer shrink-0"
          >
            <ExternalLink className="size-3.5" /> Open
          </a>
        </div>
      )}

      {status === "error" && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p>{error ?? "Failed to create sheet"}</p>
            <button
              onClick={() => { startedRef.current = false; fire(); }}
              className="underline text-xs mt-1 cursor-pointer"
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
