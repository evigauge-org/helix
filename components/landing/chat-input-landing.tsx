"use client";

import { useState, useRef } from "react";
import { signIn } from "@/lib/auth-client";
import { FolderOpen, Send } from "lucide-react";
import type { AttachedFile } from "@/lib/types";

const ACCEPTED_TYPES = ".pdf,.docx,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp";

export function ChatInputLanding() {
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (!query.trim() && files.length === 0) return;

    // Save pending query to localStorage so it runs after sign-in
    const pending: { query: string; fileNames?: string[] } = {
      query: query.trim(),
    };
    if (files.length > 0) {
      pending.fileNames = files.map((f) => f.name);
    }
    localStorage.setItem("helix-pending-query", JSON.stringify(pending));

    // Trigger Google sign-in — after auth, user lands back on / with the pending query
    signIn.social({ provider: "google" });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;
    const newFiles: AttachedFile[] = Array.from(selected).map((f) => ({
      file: f,
      name: f.name,
      size: f.size,
      type: f.type,
    }));
    setFiles((prev) => [...prev, ...newFiles]);
    e.target.value = "";
  };

  return (
    <div className="w-full max-w-[520px] sm:max-w-[480px] md:max-w-[520px] lg:max-w-[560px]">
      <div className="flex flex-col rounded-[20px] sm:rounded-[24px] border border-white/30 bg-[rgba(217,217,217,0.22)] backdrop-blur-[2px] px-4 sm:px-5 pt-3 sm:pt-4 pb-2.5 sm:pb-3 min-h-[100px] sm:min-h-[110px]">
        {/* Textarea */}
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What would you love to build today..."
          rows={2}
          className="flex-1 resize-none bg-transparent text-white placeholder:text-white/50 text-sm sm:text-base outline-none leading-relaxed"
        />

        {/* File chips */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1 mb-1">
            {files.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs text-white">
                {f.name}
                <button onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))} className="hover:text-white/60 cursor-pointer">×</button>
              </span>
            ))}
          </div>
        )}

        {/* Bottom row: folder (left) — mic + send (right) */}
        <div className="flex items-center justify-between mt-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex size-8 items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Attach file"
          >
            <FolderOpen className="size-[18px]" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleSubmit}
              className="flex size-8 items-center justify-center rounded-full border border-white/40 text-white/60 hover:text-white hover:bg-white/15 hover:border-white/60 transition-colors cursor-pointer"
              aria-label="Send message"
            >
              <Send className="size-[15px]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
