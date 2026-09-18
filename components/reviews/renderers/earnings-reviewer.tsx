"use client";

type EarningsOutput = {
  company: { ticker: string; name: string; sector?: string };
  period: { fiscalQuarter: string; fiscalYear: string; reportDate: string };
  keyMetrics: Array<{ name: string; reported: string; consensus?: string; beatMissPct?: number; yoyPct?: number }>;
  guidance: { fyOutlook: string; change: string; details: string };
  segments: Array<{ name: string; revenue: string; yoyPct?: number; commentary: string }>;
  thesisImpact: { rating: string; drivers: string[]; confidence: number };
  recommendedActions: Array<{ action: string; rationale: string }>;
  sources: Array<{ title: string; url?: string; citationType: string }>;
};

export function EarningsReviewerRenderer({ output }: { output: EarningsOutput }) {
  return (
    <div className="space-y-4 text-sm">
      <section>
        <h3 className="font-semibold text-gray-900">{output.company.name} ({output.company.ticker}) — {output.period.fiscalQuarter} {output.period.fiscalYear}</h3>
        <p className="text-xs text-gray-500">Reported {output.period.reportDate}{output.company.sector ? ` · ${output.company.sector}` : ""}</p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900">Key metrics</h3>
        <table className="w-full text-xs">
          <thead className="text-gray-500">
            <tr><th className="text-left">Metric</th><th className="text-left">Reported</th><th className="text-left">Cons.</th><th className="text-left">Beat/Miss</th><th className="text-left">YoY</th></tr>
          </thead>
          <tbody>
            {output.keyMetrics.map((m, i) => (
              <tr key={i} className="border-t">
                <td className="py-1">{m.name}</td>
                <td>{m.reported}</td>
                <td>{m.consensus ?? "—"}</td>
                <td>{m.beatMissPct != null ? `${m.beatMissPct.toFixed(1)}%` : "—"}</td>
                <td>{m.yoyPct != null ? `${m.yoyPct.toFixed(1)}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900">Guidance — {output.guidance.change}</h3>
        <p>{output.guidance.fyOutlook}</p>
        <p className="text-xs text-gray-600">{output.guidance.details}</p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900">Segments</h3>
        <ul className="space-y-1">
          {output.segments.map((s, i) => (
            <li key={i} className="rounded border px-2 py-1">
              <span className="font-medium">{s.name}</span> — {s.revenue}{s.yoyPct != null ? ` (${s.yoyPct.toFixed(1)}% YoY)` : ""}
              <p className="text-xs text-gray-600">{s.commentary}</p>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900">Thesis impact — {output.thesisImpact.rating} (conf {(output.thesisImpact.confidence * 100).toFixed(0)}%)</h3>
        <ul className="ml-5 list-disc text-gray-700">
          {output.thesisImpact.drivers.map((d, i) => <li key={i}>{d}</li>)}
        </ul>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900">Recommended actions</h3>
        <ul className="space-y-1">
          {output.recommendedActions.map((a, i) => (
            <li key={i} className="rounded border px-2 py-1">
              <span className="font-medium">{a.action}</span>
              <p className="text-xs text-gray-600">{a.rationale}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
