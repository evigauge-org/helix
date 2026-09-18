"use client";

import { useEffect, useState } from "react";
import { useUIStore } from "@/stores/ui-store";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Download, FileText, Table2, BookOpen, Loader2, Presentation, ExternalLink } from "lucide-react";
import { MarkdownRenderer } from "@/components/markdown/markdown-renderer";

const DOCX_TYPES = ["docx", "doc"];
const XLSX_TYPES = ["xlsx", "xls", "csv"];
const PPTX_TYPES = ["pptx", "ppt"];
const PDF_TYPES = ["pdf"];

type PreviewKind = "docx" | "xlsx" | "pdf" | "pptx" | "md" | "text" | "unknown";

function kindOf(type?: string): PreviewKind {
  const t = (type ?? "").toLowerCase();
  if (DOCX_TYPES.includes(t)) return "docx";
  if (XLSX_TYPES.includes(t)) return "xlsx";
  if (PPTX_TYPES.includes(t)) return "pptx";
  if (PDF_TYPES.includes(t)) return "pdf";
  if (t === "md" || t === "markdown") return "md";
  return "text";
}

function iconFor(kind: PreviewKind) {
  if (kind === "xlsx") return Table2;
  if (kind === "md") return BookOpen;
  if (kind === "pptx") return Presentation;
  return FileText;
}

interface SheetTable {
  name: string;
  rows: (string | number | boolean | null)[][];
}

export function ArtifactPreviewCanvas() {
  const preview = useUIStore((s) => s.artifactPreview);
  const closePreview = useUIStore((s) => s.closeArtifactPreview);
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [xlsxSheets, setXlsxSheets] = useState<SheetTable[] | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpen = !!preview;
  const kind = kindOf(preview?.type);
  const Icon = iconFor(kind);

  useEffect(() => {
    setDocxHtml(null);
    setXlsxSheets(null);
    setActiveSheet(0);
    setText(null);
    setError(null);
    if (!preview?.url) return;

    // PDF — browser renders natively in iframe; nothing to fetch.
    if (kind === "pdf" || kind === "pptx") {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        if (kind === "docx") {
          const res = await fetch(preview.url);
          if (!res.ok) throw new Error(`Failed to load (${res.status})`);
          const buf = await res.arrayBuffer();
          const mammoth = await import("mammoth");
          // Inline embedded images as base64 data URIs so the preview
          // renders them without additional network requests.
          const convertImage = mammoth.images.imgElement(async (image) => {
            const b64 = await image.read("base64");
            return { src: `data:${image.contentType};base64,${b64}` };
          });
          const result = await mammoth.convertToHtml(
            { arrayBuffer: buf },
            { convertImage },
          );
          if (!cancelled) setDocxHtml(result.value || "<p style='color:#6b7280'>Empty document</p>");
        } else if (kind === "xlsx") {
          const res = await fetch(preview.url);
          if (!res.ok) throw new Error(`Failed to load (${res.status})`);
          const buf = await res.arrayBuffer();
          const XLSX = await import("xlsx");
          const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
          const sheets: SheetTable[] = wb.SheetNames.map((name) => {
            const ws = wb.Sheets[name];
            const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(ws, {
              header: 1,
              defval: null,
              blankrows: false,
            });
            return { name, rows };
          });
          if (!cancelled) setXlsxSheets(sheets);
        } else {
          // md / txt / csv-like fall-through to raw text
          const res = await fetch(preview.url);
          if (!res.ok) throw new Error(`Failed to load (${res.status})`);
          const t = await res.text();
          if (!cancelled) setText(t);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [preview?.url, kind]);

  return (
    <Sheet open={isOpen} onOpenChange={() => closePreview?.()}>
      <SheetContent
        side="right"
        className="bg-white border-l border-[#0085CF]/15 p-0 flex flex-col"
        style={{
          width: "clamp(500px, 40vw, 1100px)",
          maxWidth: "min(90vw, 1100px)",
        }}
      >
        <SheetHeader className="border-b border-[#0085CF]/10 bg-[#0085CF]/5 px-5 py-4 shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base font-semibold">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#0085CF]/10">
              <Icon className="size-4 text-[#0085CF]" />
            </div>
            <span className="flex-1 truncate text-gray-800">{preview?.title ?? "Preview"}</span>
            {preview?.url && (
              <a
                href={preview.url}
                download
                className="flex items-center gap-1 rounded-lg bg-[#0085CF] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#006BA6] transition-colors cursor-pointer"
              >
                <Download className="size-3.5" /> Download
              </a>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 text-[#0085CF] animate-spin" />
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <FileText className="size-10 text-gray-300 mb-3" />
              <p className="text-sm text-gray-600">{error}</p>
              {preview?.url && (
                <a
                  href={preview.url}
                  download
                  className="mt-3 flex items-center gap-1.5 rounded-lg bg-[#0085CF] px-4 py-2 text-sm font-medium text-white hover:bg-[#006BA6] transition-colors cursor-pointer"
                >
                  <Download className="size-4" /> Download File
                </a>
              )}
            </div>
          )}

          {!loading && !error && kind === "pdf" && preview?.url && (
            <iframe src={preview.url} title={preview.title} className="h-full w-full border-0" />
          )}

          {!loading && !error && kind === "pptx" && preview?.url && (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <Presentation className="size-12 text-gray-300 mb-3" />
              <p className="text-sm text-gray-700 font-medium">PPTX preview isn&apos;t supported in-browser.</p>
              <p className="text-xs text-gray-500 mt-1 max-w-[420px]">
                Download it and open in PowerPoint / Keynote / Google Slides, or (if the link is publicly reachable) use the &ldquo;Open&rdquo; option in the artifact chip to view it in Canva.
              </p>
              <a
                href={preview.url}
                download
                className="mt-4 flex items-center gap-1.5 rounded-lg bg-[#0085CF] px-4 py-2 text-sm font-medium text-white hover:bg-[#006BA6] transition-colors cursor-pointer"
              >
                <Download className="size-4" /> Download PPTX
              </a>
            </div>
          )}

          {!loading && !error && kind === "docx" && docxHtml && (
            <div className="h-full overflow-y-auto bg-gray-50 px-6 py-8">
              <article
                className="docx-preview rounded-lg bg-white p-10 shadow-sm border border-gray-200"
                dangerouslySetInnerHTML={{ __html: docxHtml }}
              />
            </div>
          )}

          {!loading && !error && kind === "xlsx" && xlsxSheets && (
            <div className="flex h-full flex-col">
              {xlsxSheets.length > 1 && (
                <div className="flex gap-1 overflow-x-auto border-b border-gray-200 bg-gray-50 px-3 py-2 shrink-0">
                  {xlsxSheets.map((s, i) => (
                    <button
                      key={`${s.name}-${i}`}
                      onClick={() => setActiveSheet(i)}
                      className={
                        "rounded px-3 py-1 text-xs font-medium whitespace-nowrap cursor-pointer " +
                        (i === activeSheet
                          ? "bg-[#0085CF] text-white"
                          : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200")
                      }
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex-1 overflow-auto px-4 py-3">
                <table className="min-w-full border-collapse text-xs">
                  <tbody>
                    {(xlsxSheets[activeSheet]?.rows ?? []).map((row, ri) => (
                      <tr key={ri} className={ri === 0 ? "bg-[#0085CF]/5 font-semibold" : (ri % 2 === 0 ? "bg-white" : "bg-gray-50/60")}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="border border-gray-200 px-2 py-1 align-top">
                            {cell === null || cell === undefined ? "" : String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(xlsxSheets[activeSheet]?.rows?.length ?? 0) === 0 && (
                  <p className="py-6 text-center text-sm text-gray-500">Empty sheet</p>
                )}
              </div>
            </div>
          )}

          {!loading && !error && (kind === "md" || kind === "text") && text !== null && (
            <div className="h-full overflow-y-auto px-5 py-4">
              {kind === "md" || text.startsWith("#") || text.includes("\n##") ? (
                <MarkdownRenderer content={text} />
              ) : (
                <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed text-gray-700 bg-gray-50 rounded-lg p-4 border border-gray-200 overflow-x-auto">
                  {text}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Open externally for PDFs (sometimes cross-origin embed is awkward) */}
        {kind === "pdf" && preview?.url && (
          <div className="border-t border-gray-100 px-4 py-2 text-right shrink-0">
            <a
              href={preview.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[#0085CF] hover:underline cursor-pointer"
            >
              <ExternalLink className="size-3" /> Open in new tab
            </a>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
