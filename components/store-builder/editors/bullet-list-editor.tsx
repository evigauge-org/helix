// components/store-builder/editors/bullet-list-editor.tsx
"use client";

import { X, Plus } from "lucide-react";

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}

export function BulletListEditor({ value, onChange, placeholder = "Add an item" }: Props) {
  const update = (i: number, s: string) => {
    const next = [...value];
    next[i] = s;
    onChange(next);
  };
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, ""]);

  return (
    <div className="space-y-1.5">
      {value.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={item}
            onChange={(e) => update(i, e.target.value)}
            placeholder={placeholder}
            className="flex-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0085CF]/30"
          />
          <button onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 cursor-pointer" aria-label="remove">
            <X className="size-3.5" />
          </button>
        </div>
      ))}
      <button onClick={add} className="text-xs text-[#0085CF] font-medium flex items-center gap-1 cursor-pointer">
        <Plus className="size-3" /> Add item
      </button>
    </div>
  );
}

export function BulletListView({ value }: { value: string[] }) {
  return (
    <ul className="list-disc list-inside text-sm text-gray-700 space-y-0.5">
      {value.map((v, i) => (<li key={i}>{v}</li>))}
    </ul>
  );
}
