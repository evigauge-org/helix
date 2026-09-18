"use client";

type GlOutput = {
  period: { startDate: string; endDate: string; periodType: string };
  accountsReconciled: Array<{ glAccount: string; glBalance: number; subBalance: number; variance: number; materialityFlag: boolean }>;
  breaks: Array<{ id: string; glAccount: string; varianceAmount: number; severity: string; rootCause: string; evidenceCitations: string[]; suggestedJournalEntry?: { dr: string; cr: string; amount: number; narrative: string }; ownerSuggested?: string }>;
  summary: { totalBreaks: number; materialBreaks: number; totalVariance: number; signoffReadiness: boolean };
  openItems: Array<{ description: string; owner: string; eta: string }>;
};

export function GlReconcilerRenderer({ output }: { output: GlOutput }) {
  return (
    <div className="space-y-4 text-sm">
      <section>
        <h3 className="font-semibold text-gray-900">Period</h3>
        <p>{output.period.periodType} · {output.period.startDate} → {output.period.endDate}</p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900">Summary</h3>
        <p>{output.summary.totalBreaks} break{output.summary.totalBreaks === 1 ? "" : "s"} · {output.summary.materialBreaks} material · variance ${output.summary.totalVariance.toFixed(2)}</p>
        <p className={output.summary.signoffReadiness ? "text-emerald-700" : "text-amber-700"}>
          Sign-off readiness: {output.summary.signoffReadiness ? "ready" : "not ready"}
        </p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900">Accounts reconciled</h3>
        <table className="w-full text-xs">
          <thead className="text-gray-500">
            <tr><th className="text-left">Account</th><th className="text-right">GL</th><th className="text-right">Sub</th><th className="text-right">Variance</th><th></th></tr>
          </thead>
          <tbody>
            {output.accountsReconciled.map((a, i) => (
              <tr key={i} className="border-t">
                <td className="py-1">{a.glAccount}</td>
                <td className="text-right">${a.glBalance.toFixed(2)}</td>
                <td className="text-right">${a.subBalance.toFixed(2)}</td>
                <td className="text-right">${a.variance.toFixed(2)}</td>
                <td>{a.materialityFlag ? "⚠" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900">Breaks</h3>
        <ul className="space-y-2">
          {output.breaks.map((b) => (
            <li key={b.id} className="rounded border px-2 py-2">
              <p>
                <span className="mr-2 font-mono text-[10px] uppercase text-gray-500">{b.severity}</span>
                <span className="font-medium">{b.glAccount}</span> — ${b.varianceAmount.toFixed(2)}
              </p>
              <p className="mt-1 text-xs text-gray-600">Root cause: {b.rootCause}</p>
              {b.suggestedJournalEntry ? (
                <p className="mt-1 rounded bg-gray-50 px-2 py-1 font-mono text-[11px] text-gray-700">
                  Suggested JE (NOT POSTED): Dr {b.suggestedJournalEntry.dr} / Cr {b.suggestedJournalEntry.cr} ${b.suggestedJournalEntry.amount.toFixed(2)} — {b.suggestedJournalEntry.narrative}
                </p>
              ) : null}
              {b.ownerSuggested ? <p className="mt-1 text-xs text-gray-500">Owner: {b.ownerSuggested}</p> : null}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900">Open items</h3>
        <ul className="space-y-1">
          {output.openItems.map((o, i) => (
            <li key={i} className="rounded border px-2 py-1">
              {o.description} — <span className="text-gray-500">{o.owner} · {o.eta}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
