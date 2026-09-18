"use client";

import { useState, useEffect } from "react";
import { Presentation, Download, Loader2, ExternalLink, Check, AlertCircle } from "lucide-react";
import { SlideDeckViewer } from "./slide-deck-viewer";
import type { DeckStructure } from "@/lib/slide-types";

type Status = "idle" | "generating" | "preview" | "canva_processing" | "done" | "error";

export function PresentationCard({ topic, sourceText }: { topic: string; sourceText?: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [deck, setDeck] = useState<DeckStructure | null>(null);
  const [canvaUrl, setCanvaUrl] = useState<string | null>(null);
  const [pptxBlob, setPptxBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canvaConnected, setCanvaConnected] = useState<boolean | null>(null);

  // Check if user is connected to Canva
  useEffect(() => {
    fetch("/api/integrations/canva")
      .then((r) => r.json())
      .then((d) => setCanvaConnected(!!d.connected))
      .catch(() => setCanvaConnected(false));
  }, []);

  // Build PPTX blob from deck (used by both download + Canva import)
  const buildPptx = async (deckData: DeckStructure): Promise<Blob> => {
    const res = await fetch("/api/presentations/export-pptx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deck: deckData }),
    });
    if (!res.ok) throw new Error("Failed to build PPTX");
    return res.blob();
  };

  // Upload PPTX to temp store → import into Canva via Composio
  const sendToCanva = async (blob: Blob, title: string) => {
    const formData = new FormData();
    formData.append("file", blob, `${title}.pptx`);
    formData.append("title", title);

    const storeRes = await fetch("/api/presentations/store", {
      method: "POST",
      body: formData,
    });
    const storeData = await storeRes.json();
    if (!storeData.downloadUrl) throw new Error("Failed to store PPTX");

    const canvaRes = await fetch("/api/integrations/canva/design", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pptxUrl: storeData.downloadUrl,
        title: title.slice(0, 50),
        mode: "import",
      }),
    });
    const canvaData = await canvaRes.json();

    // Extract edit URL from various response shapes
    const result = canvaData.result;
    const editUrl = result?.data?.design?.urls?.edit_url
      ?? result?.design?.urls?.edit_url
      ?? result?.urls?.edit_url
      ?? (() => {
        const str = JSON.stringify(result ?? canvaData);
        const match = str.match(/https:\/\/[^"]*canva\.com[^"]*/);
        return match ? match[0] : null;
      })();

    return editUrl;
  };

  const handleGenerate = async () => {
    setStatus("generating");
    setError(null);

    try {
      // Step 1: Generate slide content with Winston framework
      const genRes = await fetch("/api/presentations/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, sourceText }),
      });
      if (!genRes.ok) throw new Error("Content generation failed");
      const { deck: generatedDeck } = await genRes.json();
      setDeck(generatedDeck);
      setStatus("preview");

      // Step 2: Build PPTX in background
      const blob = await buildPptx(generatedDeck);
      setPptxBlob(blob);

      // Step 3: Send to Canva (only if connected)
      if (canvaConnected) {
        setStatus("canva_processing");
        const editUrl = await sendToCanva(blob, generatedDeck.title);
        if (editUrl) {
          setCanvaUrl(editUrl);
          setStatus("done");
        } else {
          // Canva processing finished but no URL — still a success, user can download
          setStatus("preview");
        }
      }
    } catch (err) {
      console.error("Presentation error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  };

  const handleDownload = () => {
    if (!pptxBlob || !deck) return;
    const url = URL.createObjectURL(pptxBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${deck.title.replace(/[^a-zA-Z0-9 ]/g, "")}.pptx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="my-4 rounded-xl border border-[#0085CF]/15 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-[#0085CF]/10">
          <Presentation className="size-5 text-[#0085CF]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800">Slide Deck</p>
          <p className="text-xs text-gray-500 truncate">{topic}</p>
        </div>
      </div>

      {/* Idle — initial button */}
      {status === "idle" && (
        <button
          onClick={handleGenerate}
          className="w-full rounded-lg bg-[#0085CF] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#006BA6] transition-colors cursor-pointer"
        >
          {canvaConnected ? "Generate & Open in Canva" : "Generate Presentation"}
        </button>
      )}

      {/* Generating content */}
      {status === "generating" && (
        <div className="flex items-center justify-center gap-2 py-3 text-sm text-[#0085CF]">
          <Loader2 className="size-4 animate-spin" />
          Writing slides with Patrick Winston framework...
        </div>
      )}

      {/* Preview available + maybe processing Canva */}
      {(status === "preview" || status === "canva_processing" || status === "done") && deck && (
        <>
          <SlideDeckViewer deck={deck} />

          {/* Status bar + actions */}
          <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs text-gray-500">
              {deck.slides.length} slides · Patrick Winston framework
            </div>

            <div className="flex items-center gap-2">
              {/* Download PPTX */}
              <button
                onClick={handleDownload}
                disabled={!pptxBlob}
                className="flex items-center gap-1.5 rounded-lg border border-[#0085CF]/20 px-3 py-1.5 text-xs font-medium text-[#0085CF] hover:bg-[#0085CF]/5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Download className="size-3.5" /> PPTX
              </button>

              {/* Canva status */}
              {status === "canva_processing" && (
                <div className="flex items-center gap-1.5 rounded-lg border border-[#0085CF]/20 px-3 py-1.5 text-xs text-[#0085CF]">
                  <Loader2 className="size-3.5 animate-spin" />
                  Creating in Canva...
                </div>
              )}

              {status === "done" && canvaUrl && (
                <a
                  href={canvaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg bg-[#0085CF] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#006BA6] transition-colors cursor-pointer"
                >
                  <ExternalLink className="size-3.5" /> Open in Canva
                </a>
              )}

              {status === "preview" && canvaConnected === false && (
                <a
                  href="/integrations"
                  className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  Connect Canva →
                </a>
              )}

              {status === "preview" && canvaConnected && pptxBlob && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <Check className="size-3.5" />
                  Ready
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p>{error ?? "Failed to generate"}</p>
            <button onClick={handleGenerate} className="underline text-xs mt-1 cursor-pointer">
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
