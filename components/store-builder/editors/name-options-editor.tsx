// components/store-builder/editors/name-options-editor.tsx
"use client";

import type { BrandNameOption } from "@/lib/store-builder/types";

export function NameOptionsEditor({ value, onChange }: { value: BrandNameOption[]; onChange: (v: BrandNameOption[]) => void }) {
  const patch = (i: number, p: Partial<BrandNameOption>) => {
    const next = [...value]; next[i] = { ...next[i], ...p }; onChange(next);
  };
  return (
    <div className="space-y-2">
      {value.map((n, i) => (
        <div key={i} className="rounded-md border border-gray-200 bg-white p-2 space-y-1">
          <input value={n.name}     onChange={(e) => patch(i, { name: e.target.value })}     placeholder="Brand name" className="w-full rounded border border-gray-200 px-2 py-1 text-sm font-medium" />
          <input value={n.tagline}  onChange={(e) => patch(i, { tagline: e.target.value })}  placeholder="Tagline"    className="w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-600" />
          <textarea value={n.reasoning} onChange={(e) => patch(i, { reasoning: e.target.value })} rows={2} placeholder="Reasoning" className="w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 resize-none" />
        </div>
      ))}
    </div>
  );
}

export function NameOptionsView({ value }: { value: BrandNameOption[] }) {
  return (
    <ul className="space-y-1.5 text-sm text-gray-700">
      {value.map((n, i) => (
        <li key={i}><span className="font-medium">{n.name}</span> — <span className="italic text-gray-500">{n.tagline}</span></li>
      ))}
    </ul>
  );
}
