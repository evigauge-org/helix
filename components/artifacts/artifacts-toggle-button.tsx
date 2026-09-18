"use client";

import { Paperclip } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { useChatStore } from "@/stores/chat-store";

export function ArtifactsToggleButton() {
  const toggle = useUIStore((s) => s.toggleArtifactsPanel);
  const activeSessionId = useChatStore((s) => s.activeSessionId);

  if (!activeSessionId) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      title="Open artifacts panel"
      className="absolute top-4 right-4 z-20 flex items-center gap-1.5 rounded-full border border-[#0085CF]/20 bg-white/90 px-3 py-1.5 text-xs font-medium text-[#0085CF] shadow-sm backdrop-blur hover:bg-[#0085CF]/5 cursor-pointer"
    >
      <Paperclip className="size-3.5" />
      Artifacts
    </button>
  );
}
