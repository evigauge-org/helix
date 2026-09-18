"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { KnowledgeSourceRow, type KnowledgeSourceRowData } from "./knowledge-source-row";

export type UploaderMode =
  | { mode: "draft"; draftToken: string }
  | { mode: "agent"; agentId: string };

const ACCEPT = ".pdf,.md,.markdown,.txt,.docx,.csv";
const POLL_INTERVAL_MS = 3000;

export function KnowledgeUploader({
  target,
  onSourcesChange,
}: {
  target: UploaderMode;
  onSourcesChange?: (sources: KnowledgeSourceRowData[]) => void;
}) {
  const [sources, setSources] = useState<KnowledgeSourceRowData[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    stoppedRef.current = false;
    const url =
      target.mode === "draft"
        ? `/api/agents/knowledge?draftToken=${encodeURIComponent(target.draftToken)}`
        : `/api/agents/${encodeURIComponent(target.agentId)}/knowledge`;

    async function fetchOnce() {
      if (stoppedRef.current) return;
      try {
        const res = await fetch(url);
        if (res.ok) {
          const json = (await res.json()) as { sources: KnowledgeSourceRowData[] };
          setSources(json.sources);
          onSourcesChange?.(json.sources);
        }
      } catch {
        // ignore transient
      }
      const anyNonTerminal = (data: KnowledgeSourceRowData[]) =>
        data.some((s) => s.status === "uploading" || s.status === "processing");
      const next = anyNonTerminal(sources) ? POLL_INTERVAL_MS : POLL_INTERVAL_MS * 4;
      setTimeout(fetchOnce, next);
    }
    fetchOnce();
    return () => {
      stoppedRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.mode === "draft" ? target.draftToken : target.agentId]);

  const uploadFile = useCallback(
    async (file: File) => {
      setError(null);
      const fd = new FormData();
      fd.append("file", file);
      if (target.mode === "draft") fd.append("draftToken", target.draftToken);
      else fd.append("agentId", target.agentId);

      const res = await fetch("/api/agents/knowledge/upload", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setError(json.error ?? `Upload failed (${res.status})`);
        return;
      }
      const json = (await res.json()) as { source: KnowledgeSourceRowData };
      setSources((prev) => [...prev, json.source]);
    },
    [target],
  );

  const onDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      for (const f of files) await uploadFile(f);
    },
    [uploadFile],
  );

  const onPick = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      for (const f of files) await uploadFile(f);
      if (inputRef.current) inputRef.current.value = "";
    },
    [uploadFile],
  );

  const onDelete = useCallback(
    async (sourceId: string) => {
      if (target.mode === "draft") {
        setSources((prev) => prev.filter((s) => s.id !== sourceId));
        return;
      }
      const res = await fetch(
        `/api/agents/${encodeURIComponent(target.agentId)}/knowledge/${encodeURIComponent(sourceId)}`,
        { method: "DELETE" },
      );
      if (res.ok) setSources((prev) => prev.filter((s) => s.id !== sourceId));
    },
    [target],
  );

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed p-4 text-sm transition-colors ${
          dragOver
            ? "border-[#0085CF] bg-[#0085CF]/5 text-[#0085CF]"
            : "border-gray-300 bg-gray-50 text-gray-600 hover:border-gray-400"
        }`}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mr-2 size-4" />
        Drop files or click to upload (PDF, MD, TXT, DOCX, CSV — max 25 MB each)
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={onPick}
        />
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {sources.length > 0 ? (
        <div className="space-y-1">
          {sources.map((s) => (
            <KnowledgeSourceRow key={s.id} source={s} onDelete={onDelete} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
