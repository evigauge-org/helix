"use client";

import { useChat } from "@/hooks/use-chat";

const SUGGESTIONS = [
  { label: "What is Helix?", query: "What is Helix and what can it do?" },
  { label: "Research a topic", query: "Run deep analysis on " },
  { label: "Analyze a document", query: "Analyze the key findings in " },
  { label: "Create a presentation", query: "Create a slide deck about " },
  { label: "Instagram carousel", query: "Create an Instagram carousel about " },
  { label: "Gamma presentation", query: "Create a presentation in Gamma about " },
  { label: "Compare options", query: "Compare the pros and cons of " },
];

export function SuggestionPills() {
  const { sendMessage } = useChat();

  return (
    <div className="flex flex-wrap justify-center gap-2 mt-4 max-w-[580px]">
      {SUGGESTIONS.map((s) => (
        <button
          key={s.label}
          onClick={() => sendMessage(s.query)}
          className="rounded-full border border-[#0085CF]/15 bg-white px-4 py-1.5 text-sm text-gray-600 hover:border-[#0085CF]/40 hover:text-[#0085CF] hover:bg-[#0085CF]/5 transition-colors cursor-pointer shadow-sm"
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
