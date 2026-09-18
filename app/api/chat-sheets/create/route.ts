import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { composio, SHEETS_AUTH_CONFIG_ID } from "@/lib/composio";
import { buildBatchUpdate } from "@/lib/agents/tools/sheets/build-batch-update";
import { enterpriseReportSchema } from "@/lib/agents/tools/sheets/types";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractList(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (v?.items && Array.isArray(v.items)) return v.items;
  if (v?.data && Array.isArray(v.data)) return v.data;
  return [];
}

/**
 * Walks the shaped LLM output and replaces null/undefined cells with empty
 * strings, and boolean cells with "TRUE"/"FALSE". Also drops entirely empty
 * rows. Non-conforming structures are left alone — zod will surface those.
 */
function sanitizeShapedOutput(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const root = input as Record<string, unknown>;
  const sheets = Array.isArray(root.sheets) ? root.sheets : [];
  const cleanSheets = sheets.map((sheet) => {
    if (!sheet || typeof sheet !== "object") return sheet;
    const s = sheet as Record<string, unknown>;
    const rows = Array.isArray(s.rows) ? s.rows : [];
    const cleanRows = rows.map((row) => {
      // Row can be an array of cells or { cells: [...] }
      const cells = Array.isArray(row)
        ? row
        : row && typeof row === "object" && Array.isArray((row as { cells?: unknown[] }).cells)
          ? (row as { cells: unknown[] }).cells
          : null;
      if (cells === null) return row;
      const cleanedCells = cells.map((c) => {
        if (c === null || c === undefined) return "";
        if (typeof c === "boolean") return c ? "TRUE" : "FALSE";
        return c;
      });
      return Array.isArray(row) ? cleanedCells : { ...(row as object), cells: cleanedCells };
    });
    return { ...s, rows: cleanRows };
  });
  return { ...root, sheets: cleanSheets };
}

async function shapeIntoEnterpriseReport(topic: string, sourceText: string | undefined): Promise<unknown> {
  if (!OPENROUTER_API_KEY) throw new Error("OpenRouter not configured");
  const now = new Date();
  const dateLine = `Current date: ${now.toISOString().slice(0, 10)} (ISO ${now.toISOString()})`;

  const sourceBlock = sourceText
    ? `\n\nSOURCE MATERIAL FROM THE PRIOR CONVERSATION (this is what the user wants tabulated — base everything on this, do not invent):\n<source>\n${sourceText}\n</source>`
    : "";

  const systemPrompt = `You turn freeform research or analysis into a polished, multi-tab Google Sheet structure.

Return ONLY valid JSON (no markdown fences) matching this exact schema:

{
  "title": "<short sheet title>",
  "sheets": [
    {
      "name": "<tab name>",
      "columns": [
        { "header": "Metric", "type": "text" },
        { "header": "Value", "type": "currency" },
        { "header": "Growth %", "type": "percent" }
      ],
      "rows": [
        ["Revenue", 64988, 0.121],
        ["Net Profit", 13718, 0.058]
      ]
    }
  ]
}

Rules:
- "sheets" is an array of tab objects, each with name + columns + rows.
- Column "type" is one of: currency, percent, multiple, integer, text, date.
- "rows" is an array of arrays (primitives) — order matches columns.
- A cell can also be an object: { "value": 0.1, "role": "input" | "formula" | "cross_sheet" | "external", "background": "assumption", "source": "..." }
- Use formulas (value starts with "=") for derived numbers where sensible.
- NEVER use null or undefined for a cell value — use an empty string "" for blanks / N/A.
- Every row MUST have exactly as many cells as there are columns. Pad with "" if needed.
- Produce as many tabs / rows as the source material warrants. Don't pad with filler.
- If the source is purely qualitative, emit one "Summary" tab with two columns (Topic: text, Detail: text).`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemma-3-27b-it",
      messages: [
        { role: "system", content: dateLine },
        { role: "system", content: systemPrompt },
        { role: "user", content: `Tabulate this into a sheet: ${topic}${sourceBlock}` },
      ],
      max_tokens: 6144,
      temperature: 0.3,
    }),
  });

  if (!res.ok) throw new Error(`LLM shape failed: ${res.status}`);
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "";
  const jsonStr = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  return JSON.parse(jsonStr);
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { topic, sourceText } = await req.json();
  if (!topic && !sourceText) {
    return NextResponse.json({ error: "topic or sourceText required" }, { status: 400 });
  }

  const connections = await composio.connectedAccounts.list({
    userIds: [session.user.id],
    authConfigIds: [SHEETS_AUTH_CONFIG_ID],
    statuses: ["ACTIVE"],
  });
  const list = extractList(connections);
  if (list.length === 0) {
    return NextResponse.json(
      { error: "Google Sheets not connected. Connect at /integrations." },
      { status: 409 },
    );
  }
  const connectedAccountId = (list[0].id ?? list[0].connectedAccountId) as string | undefined;

  let shaped: unknown;
  try {
    shaped = await shapeIntoEnterpriseReport(topic ?? "Sheet", sourceText);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Shaping failed" },
      { status: 502 },
    );
  }

  // Sanitize LLM output before schema validation — LLMs occasionally emit
  // null cells, undefined values, or inconsistent row lengths. Coerce those
  // into schema-valid shapes so one bad cell doesn't reject the whole sheet.
  const sanitized = sanitizeShapedOutput(shaped);

  const parsed = enterpriseReportSchema.safeParse(sanitized);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "LLM produced an invalid sheet structure", issues: parsed.error.format() },
      { status: 502 },
    );
  }

  try {
    const createRes = await composio.tools.execute("GOOGLESHEETS_CREATE_GOOGLE_SHEET1", {
      userId: session.user.id,
      arguments: { title: parsed.data.title },
      dangerouslySkipVersionCheck: true,
    });
    if (!createRes.successful) {
      return NextResponse.json({ error: `Sheets create failed: ${createRes.error ?? "unknown"}` }, { status: 502 });
    }
    const data = createRes.data as Record<string, unknown>;
    const respData = (data?.response_data as Record<string, unknown>) ?? {};
    const spreadsheetId =
      (data?.spreadsheetId as string) ??
      (data?.id as string) ??
      (respData?.spreadsheetId as string);
    const spreadsheetUrl =
      (data?.spreadsheetUrl as string) ??
      (respData?.spreadsheetUrl as string) ??
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    if (!spreadsheetId) {
      return NextResponse.json({ error: "Sheets create returned no spreadsheetId" }, { status: 502 });
    }

    const { requests } = buildBatchUpdate(parsed.data, [{ sheetId: 0, name: "Sheet1" }]);

    const batchRes = await composio.tools.proxyExecute({
      endpoint: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      method: "POST",
      body: { requests },
      ...(connectedAccountId ? { connectedAccountId } : {}),
    });
    if (batchRes.status < 200 || batchRes.status >= 300) {
      const errData = batchRes.data as Record<string, unknown> | undefined;
      const googleErr = (errData?.error as { message?: string } | undefined)?.message;
      return NextResponse.json(
        { error: `Sheets batchUpdate failed (HTTP ${batchRes.status}): ${googleErr ?? ""}` },
        { status: 502 },
      );
    }

    return NextResponse.json({ spreadsheetId, url: spreadsheetUrl, title: parsed.data.title });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sheet creation failed" },
      { status: 500 },
    );
  }
}
