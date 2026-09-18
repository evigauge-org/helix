"use client";

type KycOutput = {
  entity: { legalName: string; registrationNumber?: string; jurisdiction?: string; type?: string };
  documentsReviewed: Array<{ filename: string; type: string; status: string }>;
  completeness: { score: number; missing: string[] };
  parties: Array<{ name: string; role: string; idVerified: boolean; sanctionsHit: boolean; pepHit: boolean; notes?: string }>;
  riskAssessment: { tier: string; drivers: string[] };
  gaps: Array<{ severity: string; what: string; recommendedAction: string }>;
  escalation: { required: boolean; to: string; rationale: string };
};

export function KycScreenerRenderer({ output }: { output: KycOutput }) {
  return (
    <div className="space-y-4 text-sm">
      <section>
        <h3 className="font-semibold text-gray-900">Entity</h3>
        <p>{output.entity.legalName} <span className="text-gray-500">({output.entity.registrationNumber ?? "no reg"} · {output.entity.jurisdiction ?? "—"})</span></p>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900">Risk assessment</h3>
        <p className="font-mono uppercase">{output.riskAssessment.tier}</p>
        <ul className="ml-5 list-disc text-gray-700">
          {output.riskAssessment.drivers.map((d, i) => <li key={i}>{d}</li>)}
        </ul>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900">Completeness — {output.completeness.score}/10</h3>
        {output.completeness.missing.length > 0 && (
          <ul className="ml-5 list-disc text-amber-800">
            {output.completeness.missing.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        )}
      </section>
      <section>
        <h3 className="font-semibold text-gray-900">Parties</h3>
        <ul className="space-y-1">
          {output.parties.map((p, i) => (
            <li key={i} className="rounded border px-2 py-1">
              <span className="font-medium">{p.name}</span> — {p.role} ·
              {p.idVerified ? " ✓ ID" : " ✗ ID"} ·
              {p.sanctionsHit ? " ⚠ sanctions" : " no sanctions"} ·
              {p.pepHit ? " ⚠ PEP" : " no PEP"}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900">Gaps</h3>
        <ul className="space-y-1">
          {output.gaps.map((g, i) => (
            <li key={i} className="rounded border px-2 py-1">
              <span className="mr-2 font-mono text-[10px] uppercase text-gray-500">{g.severity}</span>
              {g.what}
              <p className="mt-0.5 text-xs text-gray-600">→ {g.recommendedAction}</p>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="font-semibold text-gray-900">Escalation</h3>
        <p>{output.escalation.required ? `Required → ${output.escalation.to}` : "Not required"}</p>
        <p className="mt-0.5 text-xs text-gray-600">{output.escalation.rationale}</p>
      </section>
    </div>
  );
}
