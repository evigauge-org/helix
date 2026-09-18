// lib/agents/tools/india_gov/shared/csv-emit.ts
// Pure helpers for the agent prompt to format dataset rows as either an
// inline markdown table (≤20 rows) or a CSV string suitable for save_artifact.

export function rowsToMarkdownTable(records: Array<Record<string, unknown>>, maxRows = 20): string {
  if (records.length === 0) return "_(no records)_";
  const headers = Array.from(
    records.slice(0, maxRows).reduce<Set<string>>((s, r) => {
      Object.keys(r).forEach((k) => s.add(k));
      return s;
    }, new Set()),
  );
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = records.slice(0, maxRows).map((r) => {
    return `| ${headers.map((h) => formatCell(r[h])).join(" | ")} |`;
  });
  const more = records.length > maxRows ? `\n_… and ${records.length - maxRows} more rows_` : "";
  return [head, sep, ...body].join("\n") + more;
}

export function rowsToCsv(records: Array<Record<string, unknown>>): string {
  if (records.length === 0) return "";
  const headers = Array.from(
    records.reduce<Set<string>>((s, r) => {
      Object.keys(r).forEach((k) => s.add(k));
      return s;
    }, new Set()),
  );
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const head = headers.join(",");
  const body = records.map((r) => headers.map((h) => escape(r[h])).join(","));
  return [head, ...body].join("\n");
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") {
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  }
  if (typeof v === "string") {
    if (v.length > 80) return v.slice(0, 77) + "…";
    return v.replace(/\|/g, "\\|");
  }
  return String(v);
}
