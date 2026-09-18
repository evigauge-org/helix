"use client";

import { useState } from "react";
import { Check, Edit3, RefreshCw, Loader2 } from "lucide-react";

interface Props {
  onApprove: () => void;
  onEdit: (feedback: string) => void;
  onRegenerate: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function StageApprovalBar({ onApprove, onEdit, onRegenerate, loading, disabled }: Props) {
  const [editMode, setEditMode] = useState(false);
  const [feedback, setFeedback] = useState("");

  if (editMode) {
    return (
      <div className="mt-3 space-y-2">
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="What should be changed? Be specific..."
          rows={2}
          className="w-full resize-none rounded-lg border border-[#0085CF]/20 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[#0085CF]/30 placeholder:text-gray-400"
        />
        <div className="flex gap-2">
          <button
            onClick={() => { onEdit(feedback); setEditMode(false); setFeedback(""); }}
            disabled={!feedback.trim() || loading}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#0085CF] px-3 py-2 text-sm font-medium text-white hover:bg-[#006BA6] disabled:opacity-40 transition-colors cursor-pointer"
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Edit3 className="size-3.5" />}
            Apply Changes
          </button>
          <button
            onClick={() => setEditMode(false)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-[#0085CF]/10 flex items-center gap-2">
      <button
        onClick={onApprove}
        disabled={disabled || loading}
        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors cursor-pointer"
      >
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        Approve & Continue
      </button>
      <button
        onClick={() => setEditMode(true)}
        disabled={disabled || loading}
        className="flex items-center gap-1.5 rounded-lg border border-[#0085CF]/20 px-3 py-2 text-sm font-medium text-[#0085CF] hover:bg-[#0085CF]/5 disabled:opacity-40 transition-colors cursor-pointer"
      >
        <Edit3 className="size-3.5" /> Edit
      </button>
      <button
        onClick={onRegenerate}
        disabled={disabled || loading}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors cursor-pointer"
      >
        <RefreshCw className="size-3.5" /> Redo
      </button>
    </div>
  );
}
