// components/chat/followup-pills.tsx
"use client";

export function FollowupPills({
  questions,
  onPick,
}: {
  questions: string[];
  onPick: (q: string) => void;
}) {
  if (!questions || questions.length === 0) return null;
  return (
    <div className="mt-4 flex flex-col gap-2">
      <p className="text-xs font-medium text-gray-500">Related</p>
      <div className="flex flex-col gap-1.5">
        {questions.map((q, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPick(q)}
            className="group flex items-center gap-2 rounded-lg border border-[#0085CF]/15 bg-white px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:border-[#0085CF]/40 hover:bg-[#0085CF]/5"
          >
            <span className="text-[#0085CF]">→</span>
            <span>{q}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
