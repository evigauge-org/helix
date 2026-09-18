"use client";

import { useState } from "react";
import { Sparkles, Loader2, ExternalLink, Download, AlertCircle, Check, Presentation, FileText, Globe, Image } from "lucide-react";

type Format = "presentation" | "document" | "webpage" | "social";
type Status = "idle" | "generating" | "polling" | "done" | "error";

const FORMAT_OPTIONS: { value: Format; label: string; icon: React.ElementType }[] = [
  { value: "presentation", label: "Presentation", icon: Presentation },
  { value: "document",     label: "Document",     icon: FileText },
  { value: "webpage",      label: "Web Page",     icon: Globe },
  { value: "social",       label: "Social Post",  icon: Image },
];

export function GammaCard({ topic, text, sourceText }: { topic: string; text?: string; sourceText?: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [format, setFormat] = useState<Format>("presentation");
  const [gammaUrl, setGammaUrl] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [credits, setCredits] = useState<{ deducted: number; remaining: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setStatus("generating");
    setError(null);

    try {
      // Step 1: Start generation
      const genRes = await fetch("/api/integrations/gamma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          inputText: sourceText ?? text ?? topic,
          format,
          textMode: (sourceText ?? text) && (sourceText ?? text ?? "").length > 2000 ? "condense" : "generate",
          numCards: format === "social" ? 5 : 10,
          exportAs: format === "presentation" ? "pptx" : "pdf",
        }),
      });

      if (!genRes.ok) {
        const err = await genRes.json();
        throw new Error(err.error ?? "Generation failed");
      }

      const { generationId } = await genRes.json();
      if (!generationId) throw new Error("No generationId returned");

      // Step 2: Poll until done (5s intervals, 5 min max)
      setStatus("polling");
      const startTime = Date.now();
      const maxWait = 5 * 60 * 1000;

      while (Date.now() - startTime < maxWait) {
        await new Promise((r) => setTimeout(r, 5000));

        const pollRes = await fetch("/api/integrations/gamma", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "poll", generationId }),
        });

        if (!pollRes.ok) continue;
        const data = await pollRes.json();

        if (data.status === "completed") {
          setGammaUrl(data.gammaUrl);
          setExportUrl(data.exportUrl);
          setCredits(data.credits);
          setStatus("done");
          return;
        }

        if (data.status === "failed") {
          throw new Error(data.error?.message ?? "Generation failed");
        }
        // status === "pending" → keep polling
      }

      throw new Error("Generation timed out after 5 minutes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  };

  return (
    <div className="my-4 rounded-xl border border-purple-200 bg-gradient-to-br from-white to-purple-50 p-4 shadow-sm overflow-hidden relative">
      <div className="absolute -right-8 -top-8 size-24 rounded-full bg-purple-500/5 pointer-events-none" />

      {/* Header */}
      <div className="relative flex items-center gap-3 mb-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-md">
          <Sparkles className="size-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">Gamma AI</p>
          <p className="text-xs text-gray-500 truncate">{topic}</p>
        </div>
      </div>

      {/* Idle — format picker + generate */}
      {status === "idle" && (
        <div className="relative space-y-3">
          <div className="grid grid-cols-4 gap-1.5">
            {FORMAT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFormat(opt.value)}
                className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-[11px] font-medium transition-colors cursor-pointer ${
                  format === opt.value
                    ? "border-purple-400 bg-purple-50 text-purple-700"
                    : "border-gray-200 text-gray-600 hover:border-purple-200 hover:bg-purple-50/50"
                }`}
              >
                <opt.icon className="size-4" />
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleGenerate}
            className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2.5 text-sm font-medium text-white hover:from-purple-700 hover:to-pink-700 transition-all cursor-pointer shadow-sm"
          >
            Generate with Gamma AI
          </button>
        </div>
      )}

      {/* Generating */}
      {status === "generating" && (
        <div className="relative flex items-center justify-center gap-2 py-4 text-sm text-purple-700">
          <Loader2 className="size-4 animate-spin" />
          Starting Gamma generation...
        </div>
      )}

      {/* Polling */}
      {status === "polling" && (
        <div className="relative flex items-center justify-center gap-2 py-4 text-sm text-purple-700">
          <Loader2 className="size-4 animate-spin" />
          Gamma is creating your {format}... (up to 5 min)
        </div>
      )}

      {/* Done */}
      {status === "done" && (
        <div className="relative space-y-2">
          <div className="flex items-center gap-2 text-sm text-emerald-700 mb-2">
            <Check className="size-4" />
            Gamma {format} ready!
          </div>

          <div className="flex gap-2">
            {gammaUrl && (
              <a
                href={gammaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-medium text-white hover:from-purple-700 hover:to-pink-700 transition-all cursor-pointer"
              >
                <ExternalLink className="size-4" /> Open in Gamma
              </a>
            )}
            {exportUrl && (
              <a
                href={exportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-purple-200 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50 transition-colors cursor-pointer"
              >
                <Download className="size-4" /> Export
              </a>
            )}
          </div>

          {credits && (
            <p className="text-[10px] text-gray-400 mt-1">
              {credits.deducted} credits used · {credits.remaining} remaining
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="relative flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p>{error}</p>
            <button onClick={() => setStatus("idle")} className="underline text-xs mt-1 cursor-pointer">
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
