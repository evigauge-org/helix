"use client";

import { Loader2 } from "lucide-react";
import type { ResearchProgress } from "@/lib/types";
import { ResearchSteps } from "@/components/chat/inline/research-steps";

export function LiveCOT({
  researchSteps = [],
}: {
  // Kept for call-site compatibility; the component no longer branches on it.
  hasFiles?: boolean;
  researchSteps?: ResearchProgress[];
}) {
  // Empty feed (e.g. casual "thinking" before any tool runs) → simple spinner.
  if (researchSteps.length === 0) {
    return (
      <div className="my-2 flex max-w-[460px] items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
        <Loader2 className="size-4 shrink-0 animate-spin text-[#0085CF]" />
        <span className="helix-shimmer truncate text-xs font-medium text-gray-800">
          Thinking…
        </span>
      </div>
    );
  }

  return (
    <div className="my-2 max-w-[460px] rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
      <ResearchSteps steps={researchSteps} live />
    </div>
  );
}
