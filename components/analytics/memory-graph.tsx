"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain } from "lucide-react";

interface MemoryData {
  totalQueries: number;
  topics: { topic: string; count: number }[];
  tierCounts: Record<number, number>;
  timeline: { date: string; count: number }[];
  recentQueries: { id: string; query: string; tier: number; confidence: number | null; date: string }[];
}

export function MemoryGraph() {
  const [data, setData] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/memory")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="border-[#0085CF]/10 bg-white shadow-sm">
        <CardHeader><CardTitle className="text-gray-900 flex items-center gap-2"><Brain className="size-5 text-[#0085CF]" /> Memory Graph</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-gray-400 animate-pulse">Loading memory...</p></CardContent>
      </Card>
    );
  }

  if (!data || data.totalQueries === 0) {
    return (
      <Card className="border-[#0085CF]/10 bg-white shadow-sm">
        <CardHeader><CardTitle className="text-gray-900 flex items-center gap-2"><Brain className="size-5 text-[#0085CF]" /> Memory Graph</CardTitle></CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-[#0085CF]/20">
            <p className="text-sm text-gray-400">Memory graph builds as you chat. Start asking questions!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxTopicCount = Math.max(...data.topics.map((t) => t.count), 1);

  return (
    <Card className="border-[#0085CF]/10 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-gray-900 flex items-center gap-2">
          <Brain className="size-5 text-[#0085CF]" /> Memory Graph
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Topic cloud */}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Topics You Explore</p>
          <div className="flex flex-wrap gap-2">
            {data.topics.map((t) => {
              const intensity = Math.round((t.count / maxTopicCount) * 100);
              const size = intensity > 60 ? "text-base" : intensity > 30 ? "text-sm" : "text-xs";
              const weight = intensity > 60 ? "font-semibold" : intensity > 30 ? "font-medium" : "font-normal";
              return (
                <span
                  key={t.topic}
                  className={`${size} ${weight} rounded-full px-3 py-1 transition-colors`}
                  style={{
                    backgroundColor: `rgba(0, 133, 207, ${0.05 + (intensity / 100) * 0.15})`,
                    color: `rgba(0, 133, 207, ${0.5 + (intensity / 100) * 0.5})`,
                  }}
                >
                  {t.topic} <span className="text-[10px] opacity-60">({t.count})</span>
                </span>
              );
            })}
          </div>
        </div>

        {/* Activity timeline */}
        {data.timeline.length > 1 && (
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Activity Timeline</p>
            <div className="flex items-end gap-1 h-16">
              {data.timeline.map((day) => {
                const maxCount = Math.max(...data.timeline.map((d) => d.count), 1);
                const height = Math.max((day.count / maxCount) * 100, 8);
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-[#0085CF] min-w-[4px] transition-all"
                      style={{ height: `${height}%` }}
                      title={`${day.date}: ${day.count} queries`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>{data.timeline[0]?.date}</span>
              <span>{data.timeline[data.timeline.length - 1]?.date}</span>
            </div>
          </div>
        )}

        {/* Knowledge nodes — recent queries */}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Recent Knowledge</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.recentQueries.slice(0, 6).map((q) => (
              <div key={q.id} className="rounded-lg border border-[#0085CF]/10 bg-[#0085CF]/5 p-2.5">
                <p className="text-xs font-medium text-gray-700 line-clamp-2">{q.query}</p>
                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-500">
                  <span className="rounded bg-[#0085CF]/15 px-1 py-0.5 text-[#0085CF] font-medium">T{q.tier}</span>
                  {q.confidence != null && <span>{(q.confidence * 100).toFixed(0)}% conf</span>}
                  <span>{new Date(q.date).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
