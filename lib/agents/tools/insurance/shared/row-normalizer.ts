// lib/agents/tools/insurance/shared/row-normalizer.ts
// Sends a sliced section of fund-table text to an LLM (OpenRouter / gemma)
// and gets back a FundRow[]. Mirrors the direct-OpenRouter pattern from
// lib/agents/tools/llm_reason.ts so we don't introduce a second LLM client.

import { fundRowSchema, type FundRow, type SectionLocator } from "./types";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemma-4-26b-a4b-it";

export async function normalizeFundRows(args: {
  sectionText: string;
  insurerDisplay: string;
  monthLabel: string;
  locator: SectionLocator;
}): Promise<{ rows: FundRow[]; warnings: string[] }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const aliasHint = Object.entries(args.locator.columnAliases)
    .map(([raw, canon]) => `  "${raw}" → ${canon}`)
    .join("\n");

  const prompt = [
    `You are a strict JSON normalizer for Indian life-insurance fund factsheets.`,
    `Insurer: ${args.insurerDisplay}`,
    `Month: ${args.monthLabel}`,
    ``,
    `Below is the extracted fund-performance section text from the PDF. Parse it`,
    `into a JSON array of fund rows. Each row MUST conform to this schema:`,
    `{`,
    `  "fundName": string,`,
    `  "fundType": string | null,                  // e.g. "Equity", "Debt", "Hybrid"`,
    `  "nav": number | null,`,
    `  "navDate": string | null,                   // YYYY-MM-DD`,
    `  "aumCr": number | null,                     // INR crores`,
    `  "oneMonthReturn": number | null,            // %`,
    `  "threeMonthReturn": number | null,`,
    `  "sixMonthReturn": number | null,`,
    `  "oneYearReturn": number | null,`,
    `  "threeYearReturn": number | null,`,
    `  "fiveYearReturn": number | null,`,
    `  "sinceInceptionReturn": number | null,`,
    `  "inceptionDate": string | null,`,
    `  "expenseRatioPct": number | null,`,
    `  "benchmarkName": string | null`,
    `}`,
    ``,
    `Column-alias hints (raw header → canonical field name):`,
    aliasHint,
    ``,
    `RULES:`,
    `- Output ONLY a JSON array. No prose, no markdown fences.`,
    `- Use null for any field not disclosed in the text. Never estimate or fabricate.`,
    `- All numbers as JSON numbers, not strings. Strip "%" and "₹" symbols.`,
    `- If the text doesn't contain any recognizable fund row, return [].`,
    ``,
    `--- SECTION TEXT START ---`,
    args.sectionText.slice(0, 12000),
    `--- SECTION TEXT END ---`,
  ].join("\n");

  const res = await fetch(OPENROUTER_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4000,
      temperature: 0.0,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`row-normalizer upstream ${res.status}`);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("row-normalizer returned empty content");

  const cleaned = content.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(cleaned);
  } catch {
    throw new Error(`row-normalizer returned invalid JSON: ${cleaned.slice(0, 200)}`);
  }

  const arr = Array.isArray(parsedRaw)
    ? parsedRaw
    : (parsedRaw && typeof parsedRaw === "object" && "funds" in parsedRaw && Array.isArray((parsedRaw as { funds: unknown[] }).funds))
      ? (parsedRaw as { funds: unknown[] }).funds
      : null;
  if (!arr) throw new Error("row-normalizer JSON is not an array (no 'funds' key either)");

  const rows: FundRow[] = [];
  const warnings: string[] = [];
  for (let i = 0; i < arr.length; i++) {
    const result = fundRowSchema.safeParse(arr[i]);
    if (result.success) rows.push(result.data);
    else warnings.push(`row ${i} failed schema: ${result.error.issues[0]?.message ?? "unknown"}`);
  }
  return { rows, warnings };
}
