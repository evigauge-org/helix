// components/store-builder/editors/paragraph-editor.tsx
"use client";

interface Props {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}

export function ParagraphEditor({ value, onChange, rows = 6 }: Props) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-800 resize-y focus:outline-none focus:ring-2 focus:ring-[#0085CF]/30"
    />
  );
}

export function ParagraphView({ value }: { value: string }) {
  return <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{value}</p>;
}
