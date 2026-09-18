// components/store-builder/editors/product-rec-editor.tsx
"use client";

import type { ProductRecommendation } from "@/lib/store-builder/types";
import { X, Plus } from "lucide-react";

export function ProductRecEditor({ value, onChange }: { value: ProductRecommendation[]; onChange: (v: ProductRecommendation[]) => void }) {
  const patch = (i: number, p: Partial<ProductRecommendation>) => {
    const next = [...value]; next[i] = { ...next[i], ...p }; onChange(next);
  };
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, { category: "", estimatedDemand: "medium", suggestedCount: 10 }]);

  return (
    <div className="space-y-1.5">
      {value.map((r, i) => (
        <div key={i} className="grid grid-cols-6 gap-2 items-center">
          <input value={r.category} onChange={(e) => patch(i, { category: e.target.value })} className="col-span-3 rounded border border-gray-200 px-2 py-1 text-sm" placeholder="Category" />
          <select value={r.estimatedDemand} onChange={(e) => patch(i, { estimatedDemand: e.target.value as ProductRecommendation["estimatedDemand"] })} className="col-span-1 rounded border border-gray-200 px-1 py-1 text-xs">
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
          </select>
          <input type="number" value={r.suggestedCount} onChange={(e) => patch(i, { suggestedCount: Number(e.target.value) })} className="col-span-1 rounded border border-gray-200 px-2 py-1 text-sm" />
          <button onClick={() => remove(i)} className="col-span-1 text-gray-400 hover:text-red-500 cursor-pointer justify-self-end"><X className="size-4" /></button>
        </div>
      ))}
      <button onClick={add} className="text-xs text-[#0085CF] font-medium flex items-center gap-1 cursor-pointer"><Plus className="size-3" /> Add recommendation</button>
    </div>
  );
}

export function ProductRecView({ value }: { value: ProductRecommendation[] }) {
  return (
    <ul className="text-sm text-gray-700 space-y-0.5">
      {value.map((r, i) => (<li key={i}><span className="font-medium">{r.category}</span> — {r.estimatedDemand}, {r.suggestedCount} items</li>))}
    </ul>
  );
}
