// components/reviews/renderers/india-insurance-factsheet-assistant.tsx
"use client";

import { Download, ExternalLink, FileText } from "lucide-react";

type Severity = "info" | "warning" | "error";

type FundRowWithSource = {
  fundName: string;
  insurer: string;
  monthLabel: string;
  fundType: string | null;
  nav: number | null;
  aumCr: number | null;
  oneMonthReturn: number | null;
  threeMonthReturn: number | null;
  oneYearReturn: number | null;
  threeYearReturn: number | null;
  fiveYearReturn: number | null;
  sinceInceptionReturn: number | null;
  expenseRatioPct: number | null;
  benchmarkName: string | null;
  sourceCacheId: string;
  sourcePdfUrl: string;
  sourcePath: "catalog" | "fallback";
};

type FactsheetOutput = {
  query: string;
  comparisonRows: FundRowWithSource[];
  cacheIds: string[];
  warnings: Array<{
    insurer: string;
    monthLabel: string;
    message: string;
    severity: Severity;
  }>;
  recommendation?: string;
};

function fmtNum(v: number | null, suffix = ""): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v.toFixed(2)}${suffix}`;
}

function severityClass(s: Severity): string {
  return s === "error"
    ? "bg-red-50 text-red-700 border-red-200"
    : s === "warning"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-blue-50 text-blue-700 border-blue-200";
}

export function IndiaInsuranceFactsheetAssistantRenderer({ output }: { output: FactsheetOutput }) {
  return (
    <div className="space-y-4 text-sm">
      <section>
        <h3 className="font-semibold text-gray-900">Query</h3>
        <p className="mt-1 text-xs text-gray-700">{output.query}</p>
      </section>

      {output.cacheIds.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Source PDFs</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {output.cacheIds.map((id) => (
              <a
                key={id}
                href={`/api/insurance/factsheet/${id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
              >
                <FileText className="size-3" />
                {id.slice(0, 8)}
                <Download className="size-3" />
              </a>
            ))}
          </div>
        </section>
      )}

      {output.comparisonRows.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Comparison</h4>
          <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Fund</th>
                  <th className="px-2 py-1.5 text-left font-medium">Insurer · Month</th>
                  <th className="px-2 py-1.5 text-right font-medium">NAV</th>
                  <th className="px-2 py-1.5 text-right font-medium">AUM (₹Cr)</th>
                  <th className="px-2 py-1.5 text-right font-medium">1Y</th>
                  <th className="px-2 py-1.5 text-right font-medium">3Y</th>
                  <th className="px-2 py-1.5 text-right font-medium">5Y</th>
                  <th className="px-2 py-1.5 text-right font-medium">SI</th>
                  <th className="px-2 py-1.5 text-right font-medium">Expense</th>
                  <th className="px-2 py-1.5 text-right font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {output.comparisonRows.map((r, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-2 py-1.5 font-medium text-gray-900">
                      {r.fundName}
                      {r.fundType ? <span className="ml-1 text-[10px] text-gray-400">({r.fundType})</span> : null}
                    </td>
                    <td className="px-2 py-1.5 text-gray-700">
                      {r.insurer} · {r.monthLabel}
                      {r.sourcePath === "fallback" ? <span className="ml-1 text-[10px] text-amber-600">(fallback)</span> : null}
                    </td>
                    <td className="px-2 py-1.5 text-right text-gray-700">{fmtNum(r.nav)}</td>
                    <td className="px-2 py-1.5 text-right text-gray-700">{fmtNum(r.aumCr)}</td>
                    <td className="px-2 py-1.5 text-right text-gray-700">{fmtNum(r.oneYearReturn, "%")}</td>
                    <td className="px-2 py-1.5 text-right text-gray-700">{fmtNum(r.threeYearReturn, "%")}</td>
                    <td className="px-2 py-1.5 text-right text-gray-700">{fmtNum(r.fiveYearReturn, "%")}</td>
                    <td className="px-2 py-1.5 text-right text-gray-700">{fmtNum(r.sinceInceptionReturn, "%")}</td>
                    <td className="px-2 py-1.5 text-right text-gray-700">{fmtNum(r.expenseRatioPct, "%")}</td>
                    <td className="px-2 py-1.5 text-right">
                      <a
                        href={`/api/insurance/factsheet/${r.sourceCacheId}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-[10px] text-blue-600 hover:text-blue-800"
                        title={r.sourcePdfUrl}
                      >
                        PDF <ExternalLink className="size-2.5" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {output.warnings.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Warnings</h4>
          <ul className="mt-2 space-y-1">
            {output.warnings.map((w, i) => (
              <li key={i} className={`rounded border px-2 py-1 text-[11px] ${severityClass(w.severity)}`}>
                <span className="font-medium">{w.insurer} · {w.monthLabel}:</span> {w.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {output.recommendation && (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Recommendation</h4>
          <p className="mt-1 leading-relaxed text-gray-800">{output.recommendation}</p>
        </section>
      )}
    </div>
  );
}
