"use client";

type StmtOutput = {
  statementsReviewed: Array<{ name: string; period: string; type: string }>;
  consistencyChecks: Array<{ check: string; status: string; evidence: string }>;
  findings: Array<{ severity: string; area: string; issue: string; citationFromDocs: string; recommendedAction: string; standardRef?: string }>;
  auditReadinessScore: number;
  recommendations: Array<{ priority: string; action: string; rationale: string }>;
};

export function StatementAuditorRenderer({ output }: { output: StmtOutput }) {
  return (
    <div className="space-y-4 text-sm">
      <section>
        <h3 className="font-semibold text-gray-900">Audit readiness — {output.auditReadinessScore}/100</h3>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900">Statements reviewed</h3>
        <ul className="space-y-1">
          {output.statementsReviewed.map((s, i) => (
            <li key={i} className="rounded border px-2 py-1">
              <span className="font-medium">{s.name}</span> — {s.type} · {s.period}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900">Consistency checks</h3>
        <ul className="space-y-1">
          {output.consistencyChecks.map((c, i) => (
            <li key={i} className="rounded border px-2 py-1">
              <span className="mr-2 font-mono text-[10px] uppercase text-gray-500">{c.status}</span>
              {c.check}
              <p className="mt-0.5 text-xs text-gray-600">{c.evidence}</p>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900">Findings</h3>
        <ul className="space-y-1">
          {output.findings.map((f, i) => (
            <li key={i} className="rounded border px-2 py-1">
              <p>
                <span className="mr-2 font-mono text-[10px] uppercase text-gray-500">{f.severity}</span>
                <span className="font-medium">{f.area}</span> — {f.issue}
              </p>
              <p className="mt-0.5 text-xs text-gray-600">Cited: {f.citationFromDocs}</p>
              <p className="mt-0.5 text-xs text-gray-600">→ {f.recommendedAction}{f.standardRef ? ` (${f.standardRef})` : ""}</p>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900">Recommendations</h3>
        <ul className="space-y-1">
          {output.recommendations.map((r, i) => (
            <li key={i} className="rounded border px-2 py-1">
              <span className="mr-2 font-mono text-[10px] uppercase text-gray-500">{r.priority}</span>
              <span className="font-medium">{r.action}</span>
              <p className="mt-0.5 text-xs text-gray-600">{r.rationale}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
