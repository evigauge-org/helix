// components/store-builder/brainstorm-response.tsx
"use client";

import { Sparkles } from "lucide-react";

interface Props {
  message: string;
  suggestedCategories?: { label: string; description: string }[];
  onPickCategory?: (label: string) => void;
}

export function BrainstormResponse({ message, suggestedCategories, onPickCategory }: Props) {
  return (
    <div className="my-3 rounded-xl border border-[#0085CF]/15 bg-gradient-to-br from-[#0085CF]/5 to-white p-4">
      <div className="flex items-start gap-2 mb-3">
        <Sparkles className="size-4 text-[#0085CF] mt-0.5" />
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{message}</p>
      </div>
      {suggestedCategories && suggestedCategories.length > 0 && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {suggestedCategories.map((c) => (
            <button
              key={c.label}
              onClick={() => onPickCategory?.(c.label)}
              className="text-left rounded-lg border border-[#0085CF]/15 bg-white px-3 py-2 hover:border-[#0085CF]/40 hover:bg-[#0085CF]/5 transition-colors cursor-pointer"
            >
              <p className="text-sm font-semibold text-gray-800">{c.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
