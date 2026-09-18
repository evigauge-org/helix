"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cpu } from "lucide-react";

interface ModelPrice {
  id: string;
  name: string;
  prompt: number;
  completion: number;
}

export function ModelPricing() {
  const [models, setModels] = useState<ModelPrice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => setModels(d.models ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="border-[#0085CF]/10 bg-white shadow-sm">
        <CardHeader><CardTitle className="text-gray-900">Model Pricing (via OpenRouter)</CardTitle></CardHeader>
        <CardContent>
          <div className="flex h-24 items-center justify-center">
            <p className="text-sm text-gray-400 animate-pulse">Loading model pricing...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (models.length === 0) {
    return null;
  }

  return (
    <Card className="border-[#0085CF]/10 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-gray-900 flex items-center gap-2">
          <Cpu className="size-5 text-[#0085CF]" />
          Model Pricing (via OpenRouter)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#0085CF]/10">
                <th className="py-2 pr-4 text-left font-medium text-gray-500">Model</th>
                <th className="py-2 px-4 text-right font-medium text-gray-500">Input / 1M tokens</th>
                <th className="py-2 pl-4 text-right font-medium text-gray-500">Output / 1M tokens</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.id} className="border-b border-[#0085CF]/5 last:border-0">
                  <td className="py-3 pr-4">
                    <p className="font-medium text-gray-800">{m.name}</p>
                    <p className="text-xs text-gray-400">{m.id}</p>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="font-mono text-gray-900">${m.prompt.toFixed(2)}</span>
                  </td>
                  <td className="py-3 pl-4 text-right">
                    <span className="font-mono text-gray-900">${m.completion.toFixed(2)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Cost simulation */}
        <div className="mt-4 rounded-lg bg-[#0085CF]/5 border border-[#0085CF]/10 p-4">
          <p className="text-sm font-medium text-gray-800 mb-2">Estimated cost per query (Tier 3 — Deep Research)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {models.slice(0, 4).map((m) => {
              // Tier 3 estimate: ~25k input, ~12k output tokens
              const cost = (m.prompt * 25_000 / 1_000_000) + (m.completion * 12_000 / 1_000_000);
              return (
                <div key={m.id} className="rounded-md bg-white p-2 border border-[#0085CF]/10">
                  <p className="text-[10px] text-gray-400 truncate">{m.name}</p>
                  <p className="text-lg font-bold text-[#0085CF]">${cost.toFixed(3)}</p>
                  <p className="text-[10px] text-gray-400">per query</p>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-400 mt-2">Based on ~25k input + ~12k output tokens (Tier 3 average). Multi-agent uses 4 models per query.</p>
        </div>
      </CardContent>
    </Card>
  );
}
