import { FileCheck, AlertTriangle, Sparkles } from "lucide-react";
import type { ParsedFile, ParseMethod } from "@/lib/types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatChars(n: number): string {
  if (n < 1000) return `${n} chars`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k chars`;
  return `${(n / 1_000_000).toFixed(1)}M chars`;
}

const PARSE_METHOD_LABELS: Record<ParseMethod, { label: string; tone: "primary" | "secondary" }> = {
  pageindex: { label: "PageIndex", tone: "primary" },
  docling: { label: "Docling", tone: "secondary" },
  pypdf: { label: "pypdf", tone: "secondary" },
  plain_text: { label: "Plain text", tone: "secondary" },
  none: { label: "Unparsed", tone: "secondary" },
};

function ParseMethodChip({ method }: { method: ParseMethod }) {
  const meta = PARSE_METHOD_LABELS[method] ?? { label: method, tone: "secondary" as const };
  const cls = meta.tone === "primary"
    ? "bg-[#0085CF]/15 text-[#0085CF] border-[#0085CF]/20"
    : "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {method === "pageindex" && <Sparkles className="size-2.5" />}
      {meta.label}
    </span>
  );
}

export function AttachedFilesBadge({ files }: { files: ParsedFile[] }) {
  if (files.length === 0) return null;

  const successful = files.filter((f) => !f.error);
  const failed = files.filter((f) => f.error);
  const totalChunks = successful.reduce((sum, f) => sum + (f.chunks ?? 0), 0);
  const totalChars = successful.reduce((sum, f) => sum + (f.extracted_chars ?? 0), 0);
  const hasPageIndex = successful.some((f) => f.parse_method === "pageindex");

  return (
    <div className="my-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 text-sm font-medium text-emerald-700">
        <FileCheck className="size-4" />
        Processed {successful.length} file{successful.length !== 1 ? "s" : ""}
        {totalChunks > 0 && <span className="text-emerald-600/70 font-normal">· {totalChunks} chunks</span>}
        {totalChars > 0 && <span className="text-emerald-600/70 font-normal">· {formatChars(totalChars)}</span>}
        {hasPageIndex && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#0085CF]/10 px-2 py-0.5 text-[10px] font-medium text-[#0085CF]">
            <Sparkles className="size-2.5" />
            Agent-ready
          </span>
        )}
      </div>

      {/* Successful files */}
      <div className="space-y-1.5">
        {successful.map((f, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="truncate text-gray-700">{f.filename}</span>
              {f.parse_method && <ParseMethodChip method={f.parse_method} />}
            </div>
            <span className="text-gray-400 shrink-0 ml-2">
              {f.chunks != null && `${f.chunks} chunks · `}
              {f.extracted_chars != null && `${formatChars(f.extracted_chars)} · `}
              {formatSize(f.size_bytes)}
            </span>
          </div>
        ))}
      </div>

      {/* Failed files */}
      {failed.length > 0 && (
        <div className="mt-2 pt-2 border-t border-emerald-500/20 space-y-1">
          {failed.map((f, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="size-3 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="font-medium">{f.filename}</span>
                <span className="text-amber-600/80"> — {f.error}</span>
              </div>
              <span className="text-gray-400 shrink-0">{formatSize(f.size_bytes)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
