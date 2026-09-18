import mammoth from "mammoth";
import { parse as parseCsv } from "csv-parse/sync";

export type ParseLane = "md" | "txt" | "docx" | "csv";

export function laneFromFilename(filename: string): ParseLane | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "md";
  if (lower.endsWith(".txt")) return "txt";
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".csv")) return "csv";
  return null;
}

export async function parseToText(buffer: Buffer, lane: ParseLane): Promise<string> {
  switch (lane) {
    case "md":
    case "txt":
      return buffer.toString("utf-8");
    case "docx": {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case "csv": {
      const rows = parseCsv(buffer, {
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true,
      }) as Array<Record<string, unknown>>;
      return rows
        .map((row) =>
          Object.entries(row)
            .map(([k, v]) => `${k}: ${String(v ?? "")}`)
            .join(" | "),
        )
        .join("\n");
    }
  }
}
