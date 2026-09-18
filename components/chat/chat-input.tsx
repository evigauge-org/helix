"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { createId } from "@paralleldrive/cuid2";
import { useChat } from "@/hooks/use-chat";
import { useChatStore } from "@/stores/chat-store";
import { useUIStore } from "@/stores/ui-store";
import { FileChip } from "@/components/file-upload/file-chip";
import { FolderOpen, Send, Loader2, Telescope, BookOpen, X } from "lucide-react";
import { validateFiles } from "@/lib/file-validation";
import { cn } from "@/lib/utils";
import type { AttachedFile } from "@/lib/types";

const ACCEPTED_TYPES = ".pdf,.docx,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp";
const KNOWLEDGE_EXTS = [".pdf", ".md", ".markdown", ".txt", ".docx", ".csv"];

type KnowledgeChip = {
  id: string;
  filename: string;
  status: "uploading" | "processing" | "ready" | "failed";
};

function isKnowledgeFile(name: string): boolean {
  const lower = name.toLowerCase();
  return KNOWLEDGE_EXTS.some((ext) => lower.endsWith(ext));
}

export function ChatInput() {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeChip[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isLoading = useChatStore((s) => s.isLoading);
  const deepResearch = useUIStore((s) => s.deepResearch);
  const setDeepResearch = useUIStore((s) => s.setDeepResearch);
  const { sendMessage } = useChat();

  // Stable draft token for the lifetime of this input instance.
  const draftToken = useMemo(() => createId(), []);

  const uploadKnowledgeFile = useCallback(
    async (file: File) => {
      const tempId = createId();
      setKnowledge((prev) => [...prev, { id: tempId, filename: file.name, status: "uploading" }]);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("draftToken", draftToken);
      try {
        const res = await fetch("/api/agents/knowledge/upload", { method: "POST", body: fd });
        if (!res.ok) {
          setKnowledge((prev) =>
            prev.map((k) => (k.id === tempId ? { ...k, status: "failed" } : k)),
          );
          return;
        }
        const json = (await res.json()) as { source: { id: string; status: string } };
        setKnowledge((prev) =>
          prev.map((k) =>
            k.id === tempId
              ? { ...k, id: json.source.id, status: json.source.status as KnowledgeChip["status"] }
              : k,
          ),
        );
        // Poll for ready state
        const pollUntilTerminal = async () => {
          for (let i = 0; i < 60; i++) {
            await new Promise((r) => setTimeout(r, 3000));
            const list = await fetch(
              `/api/agents/knowledge?draftToken=${encodeURIComponent(draftToken)}`,
            );
            if (!list.ok) continue;
            const data = (await list.json()) as {
              sources: Array<{ id: string; status: string; filename: string }>;
            };
            const found = data.sources.find((s) => s.id === json.source.id);
            if (!found) return;
            setKnowledge((prev) =>
              prev.map((k) =>
                k.id === json.source.id
                  ? { ...k, status: found.status as KnowledgeChip["status"] }
                  : k,
              ),
            );
            if (found.status === "ready" || found.status === "failed") return;
          }
        };
        void pollUntilTerminal();
      } catch {
        setKnowledge((prev) =>
          prev.map((k) => (k.id === tempId ? { ...k, status: "failed" } : k)),
        );
      }
    },
    [draftToken],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const dropped = Array.from(e.dataTransfer.files);
      const knowledgeFiles = dropped.filter((f) => isKnowledgeFile(f.name));
      for (const f of knowledgeFiles) await uploadKnowledgeFile(f);
    },
    [uploadKnowledgeFile],
  );

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed && files.length === 0) return;
    if (isLoading) return;
    const hasKnowledge = knowledge.length > 0;
    sendMessage(
      trimmed,
      files.length > 0 ? files : undefined,
      hasKnowledge ? draftToken : undefined,
    );
    setInput("");
    setFiles([]);
    setKnowledge([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, files, knowledge, draftToken, isLoading, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;

    const incoming = Array.from(selected);
    const validation = validateFiles(files, incoming);
    if (!validation.valid) {
      setFileError(validation.error ?? "Invalid files");
      setTimeout(() => setFileError(null), 4000);
      e.target.value = "";
      return;
    }

    const newFiles: AttachedFile[] = incoming.map((f) => ({
      file: f, name: f.name, size: f.size, type: f.type,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
    setFileError(null);
    e.target.value = "";
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    const newHeight = Math.min(Math.max(el.scrollHeight, 56), 200);
    el.style.height = newHeight + "px";
    el.style.overflow = el.scrollHeight > 200 ? "auto" : "hidden";
  };

  return (
    <div className="bg-white px-4 py-3">
      <div className="mx-auto max-w-3xl">
        {/* File error */}
        {fileError && (
          <div className="mb-2 rounded-md bg-red-50 border border-red-200 px-3 py-1.5 text-xs text-red-600">
            {fileError}
          </div>
        )}

        {/* Input card */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            "flex flex-col rounded-[18px] border bg-white shadow-sm px-4 pt-3 pb-2.5 transition-colors",
            dragOver
              ? "border-[#0085CF] border-dashed bg-[#0085CF]/5"
              : "border-[#0085CF]/15",
          )}
        >
          {/* Drag overlay hint */}
          {dragOver && (
            <div className="mb-2 rounded-md bg-[#0085CF]/10 px-3 py-2 text-center text-xs font-medium text-[#0085CF]">
              Drop files here to attach as agent knowledge (PDF, MD, TXT, DOCX, CSV)
            </div>
          )}

          {/* Knowledge chips */}
          {knowledge.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {knowledge.map((k) => (
                <KnowledgeChipDisplay
                  key={k.id}
                  chip={k}
                  onRemove={() => setKnowledge((prev) => prev.filter((x) => x.id !== k.id))}
                />
              ))}
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything — research, analyze, create..."
            rows={2}
            disabled={isLoading}
            className="flex-1 resize-none overflow-hidden bg-transparent text-sm sm:text-base text-gray-800 outline-none placeholder:text-gray-400 leading-relaxed min-h-[56px] max-h-[200px]"
            style={{ scrollbarWidth: "none" }}
          />

          {/* File chips */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1 mb-1">
              {files.map((f, i) => (
                <FileChip key={i} name={f.name} onRemove={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))} />
              ))}
            </div>
          )}

          {/* Bottom row: folder (left) — mic + send (right) */}
          <div className="flex items-center justify-between mt-1 pt-1 border-t border-[#0085CF]/10">
            {/* Folder */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="flex size-8 items-center justify-center rounded-lg text-gray-400 hover:text-[#0085CF] hover:bg-[#0085CF]/5 transition-colors cursor-pointer disabled:opacity-40"
              title="Attach files for chat"
            >
              <FolderOpen className="size-[18px]" />
            </button>
            <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} multiple className="hidden" onChange={handleFileSelect} />

            {/* Mic + Deep Research + Send */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setDeepResearch(!deepResearch)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg transition-colors cursor-pointer",
                  deepResearch
                    ? "bg-[#0085CF]/10 text-[#0085CF]"
                    : "text-gray-400 hover:text-[#0085CF] hover:bg-[#0085CF]/5",
                )}
                title={deepResearch ? "Deep Research: ON — routes to backend" : "Deep Research: OFF — casual chat via OpenRouter"}
                aria-label="Toggle Deep Research"
                aria-pressed={deepResearch}
              >
                <Telescope className="size-[18px]" />
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading || (!input.trim() && files.length === 0)}
                className="flex size-8 items-center justify-center rounded-full bg-[#0085CF] text-white hover:bg-[#006BA6] disabled:opacity-40 transition-colors cursor-pointer"
              >
                {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-[15px]" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KnowledgeChipDisplay({
  chip,
  onRemove,
}: {
  chip: KnowledgeChip;
  onRemove: () => void;
}) {
  const colorClass =
    chip.status === "ready"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : chip.status === "failed"
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-violet-50 text-violet-700 border-violet-200";
  const statusLabel =
    chip.status === "uploading"
      ? "Uploading…"
      : chip.status === "processing"
        ? "Processing…"
        : chip.status === "ready"
          ? "Ready"
          : "Failed";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        colorClass,
      )}
      title={`Knowledge source — ${statusLabel}`}
    >
      <BookOpen className="size-3" />
      <span className="max-w-[140px] truncate">{chip.filename}</span>
      <span className="text-[10px] opacity-70">· {statusLabel}</span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 cursor-pointer"
        aria-label="Remove knowledge source"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
