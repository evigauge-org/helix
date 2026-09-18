"use client";

type DatasetCitation = {
  resourceId: string;
  sourceUrl: string;
  visualizeUrl: string | null;
  accessedAt: string;
  publisherLastUpdate: string | null;
};

type NumericClaim = {
  claim: string;
  value: number | "Not disclosed";
  unit?: string;
  citations: DatasetCitation[];
  _confidence: "high" | "medium" | "low";
};

type CaAuditOutput = {
  workingPaperRef: string;
  scope: string;
  findings: Array<{
    label: string;
    summary: string;
    underlyingClaims: NumericClaim[];
    derivedValue?: number | "Not applicable";
    derivationCode?: string;
  }>;
  csvArtifactPath?: string;
  chartArtifactPath?: string;
};

const confidenceClass: Record<NumericClaim["_confidence"], string> = {
  high: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-rose-100 text-rose-800",
};

function formatValue(value: NumericClaim["value"], unit?: string) {
  if (value === "Not disclosed") return "Not disclosed";
  const formatted = typeof value === "number" ? value.toLocaleString("en-IN") : String(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function IndiaCaAuditAssistantRenderer({ output }: { output: CaAuditOutput }) {
  return (
    <div className="space-y-4 text-sm">
      <section>
        <h3 className="font-semibold text-gray-900">Working paper {output.workingPaperRef}</h3>
        <p className="text-xs text-gray-600">{output.scope}</p>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold text-gray-900">Findings</h3>
        {output.findings.map((f, i) => (
          <div key={i} className="rounded border px-3 py-2">
            <div className="font-medium">{f.label}</div>
            <p className="mt-0.5 text-xs text-gray-700">{f.summary}</p>

            {f.underlyingClaims.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Underlying claims
                </div>
                <ul className="space-y-1">
                  {f.underlyingClaims.map((c, j) => (
                    <li key={j} className="rounded bg-gray-50 px-2 py-1.5">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-xs">{c.claim}</span>
                        <span className="font-mono text-xs">{formatValue(c.value, c.unit)}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${confidenceClass[c._confidence]}`}
                        >
                          {c._confidence}
                        </span>
                      </div>
                      {c.citations.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {c.citations.map((cit, k) => (
                            <a
                              key={k}
                              href={cit.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] text-blue-700 hover:bg-blue-50"
                              title={`accessed ${cit.accessedAt}${cit.publisherLastUpdate ? ` · published ${cit.publisherLastUpdate}` : ""}`}
                            >
                              {cit.resourceId}
                            </a>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {f.derivedValue !== undefined && (
              <div className="mt-2 text-xs">
                <span className="font-semibold text-gray-700">Derived value: </span>
                <span className="font-mono">
                  {f.derivedValue === "Not applicable"
                    ? "Not applicable"
                    : f.derivedValue.toLocaleString("en-IN")}
                </span>
              </div>
            )}

            {f.derivationCode && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Derivation code
                </summary>
                <pre className="mt-1 max-h-60 overflow-auto rounded bg-gray-900 p-2 text-[11px] text-gray-100">
                  {f.derivationCode}
                </pre>
              </details>
            )}
          </div>
        ))}
      </section>

      {(output.csvArtifactPath || output.chartArtifactPath) && (
        <section>
          <h3 className="font-semibold text-gray-900">Artifacts</h3>
          <ul className="mt-1 space-y-1">
            {output.csvArtifactPath && (
              <li>
                <a
                  href={output.csvArtifactPath}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 hover:underline"
                >
                  Download CSV
                </a>
              </li>
            )}
            {output.chartArtifactPath && (
              <li>
                <a
                  href={output.chartArtifactPath}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 hover:underline"
                >
                  Download chart (PNG)
                </a>
              </li>
            )}
          </ul>
        </section>
      )}
    </div>
  );
}
