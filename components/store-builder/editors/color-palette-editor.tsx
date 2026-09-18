// components/store-builder/editors/color-palette-editor.tsx
"use client";

type Palette = { primary: string; secondary: string; accent: string; neutral: string; background: string; text: string };

export function ColorPaletteEditor({ value, onChange }: { value: Palette; onChange: (v: Palette) => void }) {
  const slots: (keyof Palette)[] = ["primary", "secondary", "accent", "neutral", "background", "text"];
  return (
    <div className="grid grid-cols-3 gap-2">
      {slots.map((s) => (
        <div key={s} className="flex items-center gap-2 rounded border border-gray-200 bg-white p-1.5">
          <input type="color" value={value[s]} onChange={(e) => onChange({ ...value, [s]: e.target.value })} className="size-6 rounded border-0 cursor-pointer" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 capitalize">{s}</p>
            <input value={value[s]} onChange={(e) => onChange({ ...value, [s]: e.target.value })} className="w-full text-xs text-gray-800 outline-none" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ColorPaletteView({ value }: { value: Palette }) {
  const slots: (keyof Palette)[] = ["primary", "secondary", "accent", "neutral", "background", "text"];
  return (
    <div className="flex flex-wrap gap-2">
      {slots.map((s) => (
        <div key={s} className="flex items-center gap-1.5 text-xs text-gray-700">
          <span className="size-5 rounded border border-gray-200" style={{ backgroundColor: value[s] }} />
          <span className="capitalize">{s}</span>
          <span className="text-gray-400">{value[s]}</span>
        </div>
      ))}
    </div>
  );
}
