// components/store-builder/editors/market-pricing-editor.tsx
"use client";

import type { MarketPricingTier } from "@/lib/store-builder/types";

export function MarketPricingEditor({ value, onChange }: { value: MarketPricingTier[]; onChange: (v: MarketPricingTier[]) => void }) {
  const patch = (i: number, p: Partial<MarketPricingTier>) => {
    const next = [...value]; next[i] = { ...next[i], ...p }; onChange(next);
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-gray-500">
          <tr><th className="text-left pb-1">Market</th><th>Currency</th><th>Low</th><th>Mid</th><th>High</th></tr>
        </thead>
        <tbody>
          {value.map((p, i) => (
            <tr key={`${p.market}-${i}`} className="border-t border-gray-100">
              <td className="py-1 pr-2 text-gray-700 uppercase">{p.market}</td>
              <td className="py-1 pr-2 text-gray-500">{p.symbol}{p.currency}</td>
              <td><input type="number" value={p.low}  onChange={(e) => patch(i, { low:  Number(e.target.value) })} className="w-20 rounded border border-gray-200 px-1.5 py-0.5 text-sm" /></td>
              <td><input type="number" value={p.mid}  onChange={(e) => patch(i, { mid:  Number(e.target.value) })} className="w-20 rounded border border-gray-200 px-1.5 py-0.5 text-sm" /></td>
              <td><input type="number" value={p.high} onChange={(e) => patch(i, { high: Number(e.target.value) })} className="w-20 rounded border border-gray-200 px-1.5 py-0.5 text-sm" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MarketPricingView({ value }: { value: MarketPricingTier[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
      {value.map((p) => (
        <div key={p.market} className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5">
          <p className="text-xs text-gray-500 uppercase">{p.market} — {p.currency}</p>
          <p className="font-medium text-gray-800">{p.symbol}{p.low} / {p.symbol}{p.mid} / {p.symbol}{p.high}</p>
          {p.reasoning && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{p.reasoning}</p>}
        </div>
      ))}
    </div>
  );
}
