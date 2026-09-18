"use client";

import { Trash2, FileText, FileType, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export interface KnowledgeSourceRowData {
  id: string;
  filename: string;
  lane: "pageindex" | "pgvector";
  status: "uploading" | "processing" | "ready" | "failed";
  errorMessage: string | null;
  sizeBytes: number;
  pageCount: number | null;
  chunkCount: number;
}

const LANE_BADGE: Record<string, string> = {
  pageindex: "PDF",
  pgvector: "TEXT",
};

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function KnowledgeSourceRow({
  source,
  onDelete,
  busy,
}: {
  source: KnowledgeSourceRowData;
  onDelete: (id: string) => void;
  busy?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
      {source.lane === "pageindex" ? (
        <FileType className="size-4 text-gray-500" />
      ) : (
        <FileText className="size-4 text-gray-500" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-gray-900">{source.filename}</span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
            {LANE_BADGE[source.lane]}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-gray-500">
          <span>{fmtBytes(source.sizeBytes)}</span>
          {source.lane === "pageindex" && source.pageCount ? <span>{source.pageCount} pages</span> : null}
          {source.lane === "pgvector" && source.chunkCount > 0 ? <span>{source.chunkCount} chunks</span> : null}
          <StatusBadge status={source.status} errorMessage={source.errorMessage} />
        </div>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => onDelete(source.id)}
        className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        aria-label={`Delete ${source.filename}`}
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

function StatusBadge({
  status,
  errorMessage,
}: {
  status: KnowledgeSourceRowData["status"];
  errorMessage: string | null;
}) {
  if (status === "uploading" || status === "processing") {
    return (
      <span className="flex items-center gap-1 text-amber-600">
        <Loader2 className="size-3 animate-spin" />
        {status === "uploading" ? "Uploading…" : "Processing…"}
      </span>
    );
  }
  if (status === "ready") {
    return (
      <span className="flex items-center gap-1 text-emerald-600">
        <CheckCircle2 className="size-3" />
        Ready
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-red-600" title={errorMessage ?? undefined}>
      <AlertCircle className="size-3" />
      Failed
    </span>
  );
}
