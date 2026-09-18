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

type CfoInsightOutput = {
  topic: string;
  narrative: string;
  trendClaims: NumericClaim[];
  chartSpec?: {
    chartType: "line" | "bar" | "stacked-bar" | "mixed";
    xField: string;
    yFields: string[];
    title: string;
  };
  recommendations?: string[];
  artifactPaths: {
    csvPath?: string;
    chartPath?: string;
    docxPath?: string;
  };
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

export function IndiaCfoInsightAssistantRenderer({ output }: { output: CfoInsightOutput }) {
  const hasArtifacts =
    output.artifactPaths.csvPath ||
    output.artifactPaths.chartPath ||
    output.artifactPaths.docxPath;

  return (
    <div className="space-y-4 text-sm">
      <section>
        <h3 className="font-semibold text-gray-900">{output.topic}</h3>
        <p className="mt-1 whitespace-pre-wrap text-gray-700">{output.narrative}</p>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900">Trend claims</h3>
        <ul className="mt-1 space-y-1.5">
          {output.trendClaims.map((c, i) => (
            <li key={i} className="rounded bg-gray-50 px-2 py-1.5">
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
      </section>

      {output.chartSpec && (
        <section>
          <h3 className="font-semibold text-gray-900">Chart spec</h3>
          <div className="mt-1 rounded border px-3 py-2 text-xs">
            <div className="font-medium">{output.chartSpec.title}</div>
            <div className="mt-1 text-gray-600">
              <span className="font-mono uppercase">{output.chartSpec.chartType}</span>
              {" · x = "}
              <span className="font-mono">{output.chartSpec.xField}</span>
              {" · y = "}
              <span className="font-mono">{output.chartSpec.yFields.join(", ")}</span>
            </div>
          </div>
        </section>
      )}

      {output.recommendations && output.recommendations.length > 0 && (
        <section>
          <h3 className="font-semibold text-gray-900">Recommendations</h3>
          <ul className="ml-5 list-disc text-gray-700">
            {output.recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      {hasArtifacts && (
        <section>
          <h3 className="font-semibold text-gray-900">Artifacts</h3>
          <ul className="mt-1 space-y-1">
            {output.artifactPaths.csvPath && (
              <li>
                <a
                  href={output.artifactPaths.csvPath}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 hover:underline"
                >
                  Download CSV
                </a>
              </li>
            )}
            {output.artifactPaths.chartPath && (
              <li>
                <a
                  href={output.artifactPaths.chartPath}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 hover:underline"
                >
                  Download chart (PNG)
                </a>
              </li>
            )}
            {output.artifactPaths.docxPath && (
              <li>
                <a
                  href={output.artifactPaths.docxPath}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 hover:underline"
                >
                  Download brief (DOCX)
                </a>
              </li>
            )}
          </ul>
        </section>
      )}
    </div>
  );
}
