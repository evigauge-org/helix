"use client";

import { useState } from "react";
import { Image, Download, Loader2, Eye, X } from "lucide-react";

export function CarouselCard({ topic, sourceText }: { topic: string; sourceText?: string }) {
  const [status, setStatus] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [html, setHtml] = useState<string | null>(null);
  const [info, setInfo] = useState<{ slideCount: number; brandName: string } | null>(null);
  const [preview, setPreview] = useState(false);

  const handleGenerate = async () => {
    setStatus("generating");
    try {
      const res = await fetch("/api/carousel/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, brandName: "Helix", sourceText }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();
      setHtml(data.html);
      setInfo({ slideCount: data.slideCount, brandName: data.brandName });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  const handleDownload = () => {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${topic.slice(0, 40).replace(/[^a-zA-Z0-9 ]/g, "")}-carousel.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="my-4 rounded-xl border border-[#0085CF]/15 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-purple-600">
            <Image className="size-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">Instagram Carousel</p>
            <p className="text-xs text-gray-500">{topic}</p>
          </div>
        </div>

        {status === "idle" && (
          <button
            onClick={handleGenerate}
            className="w-full rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity cursor-pointer"
          >
            Generate Carousel
          </button>
        )}

        {status === "generating" && (
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-purple-600">
            <Loader2 className="size-4 animate-spin" />
            Designing carousel slides with AI...
          </div>
        )}

        {status === "done" && (
          <div className="space-y-2">
            <div className="text-xs text-gray-500 mb-2">
              {info?.brandName} — {info?.slideCount} slides
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPreview(true)}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity cursor-pointer"
              >
                <Eye className="size-4" /> Preview
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 rounded-lg border border-purple-200 px-4 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 transition-colors cursor-pointer"
              >
                <Download className="size-4" /> HTML
              </button>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="text-sm text-red-600 text-center py-2">
            Failed to generate. <button onClick={handleGenerate} className="underline cursor-pointer">Try again</button>
          </div>
        )}
      </div>

      {/* Full-screen preview modal */}
      {preview && html && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="relative bg-white rounded-xl overflow-hidden max-w-[480px] w-full max-h-[90vh]">
            <button
              onClick={() => setPreview(false)}
              className="absolute top-3 right-3 z-10 flex size-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 cursor-pointer"
            >
              <X className="size-4" />
            </button>
            <iframe
              srcDoc={
                html.trim().startsWith("<!DOCTYPE") || html.trim().startsWith("<html")
                  ? html
                  : `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#f5f5f5;display:flex;justify-content:center;padding:20px;color:#1a1a1a}</style></head><body><div style="max-width:420px;width:100%;background:white;border-radius:12px;padding:24px;box-shadow:0 2px 20px rgba(0,0,0,0.1)">${html}</div></body></html>`
              }
              className="w-full border-0"
              style={{ height: "80vh" }}
              sandbox="allow-scripts"
              title="Carousel Preview"
            />
          </div>
        </div>
      )}
    </>
  );
}
