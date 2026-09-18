"use client";

import { useEffect, useState } from "react";
import { FileText, Download, Loader2, FileSpreadsheet, FileCode, Presentation, BookOpen, Eye } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";

export interface ArtifactLite {
  id: string;
  name: string;
  mimeType: string;
}

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

function artifactTypeHint(ext: string): "md" | "xlsx" | "docx" | "pdf" | "pptx" | "txt" | "csv" | string {
  if (ext === "md" || ext === "markdown") return "md";
  if (ext === "xlsx" || ext === "xls") return "xlsx";
  if (ext === "docx" || ext === "doc") return "docx";
  if (ext === "pptx" || ext === "ppt") return "pptx";
  if (ext === "pdf") return "pdf";
  if (ext === "csv") return "csv";
  return "txt";
}

export function ArtifactChip({ id, name, mimeType }: ArtifactLite) {
  const openPreview = useUIStore((s) => s.openArtifactPreview);
  const ext = extFromName(name);
  const Icon = iconFor(ext);
  const downloadUrl = `/api/agent-artifacts/${id}/download`;

  return (
    <span className="inline-flex items-center gap-1.5 my-1 mr-2 rounded-full border border-[#0085CF]/20 bg-[#0085CF]/5 px-2.5 py-1 text-xs font-medium text-[#0085CF] align-middle">
      <Icon className="size-3.5" />
      <span className="max-w-[220px] truncate">{name}</span>
      <button
        type="button"
        aria-label="Preview"
        onClick={() => openPreview({ url: downloadUrl, title: name, type: artifactTypeHint(ext) })}
        className="flex size-5 items-center justify-center rounded-full hover:bg-[#0085CF]/15 cursor-pointer"
        title="Preview"
      >
        <Eye className="size-3" />
      </button>
      <a
        href={downloadUrl}
        download={name}
        aria-label="Download"
        className="flex size-5 items-center justify-center rounded-full hover:bg-[#0085CF]/15 cursor-pointer"
        title="Download"
      >
        <Download className="size-3" />
      </a>
      <span className="sr-only">{mimeType}</span>
    </span>
  );
}

interface ResolverProps {
  artifactId: string;
  fallbackName?: string;
}

/**
 * Renders an ArtifactChip by fetching the artifact metadata by id.
 * Used by the markdown "artifact:ID" link renderer.
 */
export function ArtifactChipById({ artifactId, fallbackName }: ResolverProps) {
  const [meta, setMeta] = useState<ArtifactLite | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/agent-artifacts/${artifactId}/meta`);
        if (!res.ok) {
          if (!cancelled) setError(`(not found)`);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setMeta({
            id: artifactId,
            name: data.name ?? fallbackName ?? artifactId,
            mimeType: data.mimeType ?? "application/octet-stream",
          });
        }
      } catch {
        if (!cancelled) setError("(network)");
      }
    })();
    return () => { cancelled = true; };
  }, [artifactId, fallbackName]);

  if (error) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600 align-middle">
        <FileText className="size-3" /> {fallbackName ?? "artifact"} {error}
      </span>
    );
  }

  if (!meta) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-0.5 text-xs text-gray-500 align-middle">
        <Loader2 className="size-3 animate-spin" /> {fallbackName ?? "loading…"}
      </span>
    );
  }

  return <ArtifactChip id={meta.id} name={meta.name} mimeType={meta.mimeType} />;
}
