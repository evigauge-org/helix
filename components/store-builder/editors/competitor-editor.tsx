// components/store-builder/editors/competitor-editor.tsx
"use client";

import type { Competitor } from "@/lib/store-builder/types";
import { X, Plus } from "lucide-react";

export function CompetitorEditor({ value, onChange }: { value: Competitor[]; onChange: (v: Competitor[]) => void }) {
  const patch = (i: number, p: Partial<Competitor>) => {
    const next = [...value]; next[i] = { ...next[i], ...p }; onChange(next);
  };
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, { name: "", url: "", priceRange: "", positioning: "", strengths: [] }]);

  return (
    <div className="space-y-3">
      {value.map((c, i) => (
        <div key={i} className="rounded-md border border-gray-200 bg-white p-2.5 space-y-1.5">
          <div className="flex items-center gap-2">
            <input value={c.name} onChange={(e) => patch(i, { name: e.target.value })} placeholder="Name" className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm" />
            <button onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 cursor-pointer"><X className="size-4" /></button>
          </div>
          <input value={c.url} onChange={(e) => patch(i, { url: e.target.value })} placeholder="https://..." className="w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-600" />
          <div className="grid grid-cols-2 gap-2">
            <input value={c.priceRange} onChange={(e) => patch(i, { priceRange: e.target.value })} placeholder="Price range" className="rounded border border-gray-200 px-2 py-1 text-xs" />
            <input value={c.positioning} onChange={(e) => patch(i, { positioning: e.target.value })} placeholder="Positioning" className="rounded border border-gray-200 px-2 py-1 text-xs" />
          </div>
          <input
            value={c.strengths.join(", ")}
            onChange={(e) => patch(i, { strengths: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            placeholder="Strengths (comma-separated)"
            className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
          />
        </div>
      ))}
      <button onClick={add} className="text-xs text-[#0085CF] font-medium flex items-center gap-1 cursor-pointer"><Plus className="size-3" /> Add competitor</button>
    </div>
  );
}

export function CompetitorView({ value }: { value: Competitor[] }) {
  return (
    <ul className="space-y-1.5 text-sm text-gray-700">
      {value.map((c, i) => (
        <li key={i}>
          <span className="font-medium text-gray-800">{c.name}</span> — {c.priceRange}, {c.positioning}
          {c.strengths.length > 0 && <span className="text-gray-500"> · {c.strengths.join(" · ")}</span>}
        </li>
      ))}
    </ul>
  );
}
