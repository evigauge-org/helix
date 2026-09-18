import { registerTool } from "../../tool-registry";
import type { ToolDef } from "../../types";
import { composio, SHEETS_AUTH_CONFIG_ID } from "@/lib/composio";
import { buildBatchUpdate } from "./build-batch-update";
import { enterpriseReportSchema } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractList(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (v?.items && Array.isArray(v.items)) return v.items;
  if (v?.data && Array.isArray(v.data)) return v.data;
  return [];
}

const tool: ToolDef<typeof enterpriseReportSchema> = {
  slug: "create_enterprise_report",
  requiresApproval: true,
  description: `Create a polished multi-tab Google Sheet with Goldman/BlackRock-grade formatting. Server applies navy headers, frozen row 1, banded rows, XLSX color coding (blue inputs / black formulas / green cross-sheet / red external / yellow assumptions), number formats, borders, and auto-sizing. Returns { spreadsheetId, url }.

REQUIRED shape (minimal example — copy this structure exactly):
{
  "title": "TCS Q4 FY26 Summary",
  "sheets": [
    {
      "name": "Summary",
      "columns": [
        { "header": "Metric", "type": "text" },
        { "header": "Value ($mm)", "type": "currency" },
        { "header": "Growth %", "type": "percent" }
      ],
      "rows": [
        [ "Revenue", 64988, 0.121 ],
        [ "Net Profit", 13718, 0.058 ],
        [ { "value": "Assumption", "background": "assumption" }, { "value": 0.1, "role": "input" }, { "value": "=B2/B3", "role": "formula" } ]
      ]
    }
  ]
}

Rules:
- "sheets" MUST be an array of tab objects (each with name + columns + rows).
- "rows" can be array-of-arrays (primitive values) OR array of { cells: [...] } — both are accepted.
- Cells can be raw primitives ("text" or 42) OR objects { value, role?, background?, source?, format_override? }.
- Column "type" is one of: currency | percent | multiple | integer | text | date.
- Use formulas (value starting with "=") instead of hardcoded computed values where possible.`,
  schema: enterpriseReportSchema,
  async execute(ctx, args) {
    try {
      const connections = await composio.connectedAccounts.list({
        userIds: [ctx.userId],
        authConfigIds: [SHEETS_AUTH_CONFIG_ID],
        statuses: ["ACTIVE"],
      });
      const list = extractList(connections);
      if (list.length === 0) {
        return { ok: false, error: "Google Sheets not connected. Ask the user to connect it at /integrations." };
      }
      const connectedAccountId = (list[0].id ?? list[0].connectedAccountId) as string | undefined;

      const createRes = await composio.tools.execute("GOOGLESHEETS_CREATE_GOOGLE_SHEET1", {
        userId: ctx.userId,
        arguments: { title: args.title },
        dangerouslySkipVersionCheck: true,
      });
      if (!createRes.successful) {
        return { ok: false, error: `Sheets create failed: ${createRes.error ?? "unknown"}` };
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
        return { ok: false, error: "Sheets create returned no spreadsheetId" };
      }

      const { requests } = buildBatchUpdate(args, [{ sheetId: 0, name: "Sheet1" }]);

      // Composio has no first-class slug for Google's structural
      // spreadsheets.batchUpdate endpoint (GOOGLESHEETS_BATCH_UPDATE is a
      // deprecated values-write tool). Use proxyExecute to hit Google's real
      // REST endpoint with our requests[] array.
      const batchRes = await composio.tools.proxyExecute({
        endpoint: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        method: "POST",
        body: { requests },
        ...(connectedAccountId ? { connectedAccountId } : {}),
      });
      if (batchRes.status < 200 || batchRes.status >= 300) {
        const errData = batchRes.data as Record<string, unknown> | undefined;
        const googleErr = (errData?.error as { message?: string } | undefined)?.message;
        return {
          ok: false,
          error: `Sheets batchUpdate failed (HTTP ${batchRes.status}): ${googleErr ?? JSON.stringify(errData ?? {}).slice(0, 500)}`,
        };
      }

      return { ok: true, data: { spreadsheetId, url: spreadsheetUrl } };
    } catch (e) {
      return { ok: false, error: `create_enterprise_report failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  },
};

registerTool(tool);
export default tool;
