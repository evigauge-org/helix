import { z } from "zod";
import { registerTool } from "../../tool-registry";
import type { ToolDef } from "../../types";
import { composio, SHEETS_AUTH_CONFIG_ID } from "@/lib/composio";
import { cellSchema, ROLE_TEXT_COLORS, BANDED_ROW_BG, NUMBER_FORMATS } from "./types";
import { inferColumnType } from "./infer-column-type";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractList(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (v?.items && Array.isArray(v.items)) return v.items;
  if (v?.data && Array.isArray(v.data)) return v.data;
  return [];
}

const schema = z.object({
  spreadsheet_id: z.string(),
  sheet_name: z.string(),
  rows: z.array(z.object({ cells: z.array(cellSchema).max(100) })).max(500),
});

const tool: ToolDef<typeof schema> = {
  slug: "write_rows",
  requiresApproval: true,
  description: "Append rows to an existing Google Sheet tab. New rows inherit column types inferred from the header row (row 1). Use this for incremental updates to sheets created via create_enterprise_report.",
  schema,
  async execute(ctx, args) {
    try {
      const connections = await composio.connectedAccounts.list({
        userIds: [ctx.userId],
        authConfigIds: [SHEETS_AUTH_CONFIG_ID],
        statuses: ["ACTIVE"],
      });
      const conns = extractList(connections);
      if (conns.length === 0) {
        return { ok: false, error: "Google Sheets not connected." };
      }
      const connectedAccountId = (conns[0].id ?? conns[0].connectedAccountId) as string | undefined;

      const metaRes = await composio.tools.execute("GOOGLESHEETS_GET_SPREADSHEET_INFO", {
        userId: ctx.userId,
        arguments: { spreadsheet_id: args.spreadsheet_id },
        dangerouslySkipVersionCheck: true,
      });
      if (!metaRes.successful) return { ok: false, error: `Sheets metadata fetch failed: ${metaRes.error ?? "unknown"}` };
      const meta = metaRes.data as Record<string, unknown>;
      const sheets = (meta?.sheets ?? (meta?.response_data as Record<string, unknown>)?.sheets) as Array<{
        properties?: { sheetId?: number; title?: string; gridProperties?: { rowCount?: number; columnCount?: number } };
      }> | undefined;
      if (!sheets) return { ok: false, error: "could not parse sheets metadata" };
      const target = sheets.find((s) => s.properties?.title === args.sheet_name);
      if (!target) return { ok: false, error: `sheet "${args.sheet_name}" not found` };
      const sheetId = target.properties!.sheetId!;
      const existingRowCount = target.properties?.gridProperties?.rowCount ?? 0;

      const headerRes = await composio.tools.execute("GOOGLESHEETS_BATCH_GET", {
        userId: ctx.userId,
        arguments: { spreadsheet_id: args.spreadsheet_id, ranges: [`${args.sheet_name}!1:1`] },
        dangerouslySkipVersionCheck: true,
      });
      const headerData = headerRes.data as Record<string, unknown>;
      const valueRanges = (headerData?.valueRanges ?? (headerData?.response_data as Record<string, unknown>)?.valueRanges) as Array<{ values?: string[][] }> | undefined;
      const headers: string[] = valueRanges?.[0]?.values?.[0] ?? [];
      const inferredTypes = headers.map(inferColumnType);

      const startRowIndex = existingRowCount;
      const rowRequests = args.rows.map((r, rowIdx) => ({
        values: r.cells.map((cell, colIdx) => {
          const colType = inferredTypes[colIdx] ?? "text";
          const fmt = NUMBER_FORMATS[colType];
          const banded = (startRowIndex + rowIdx) % 2 === 1;
          const userEnteredValue: Record<string, unknown> =
            typeof cell.value === "string" && cell.value.trim().startsWith("=")
              ? { formulaValue: cell.value }
              : typeof cell.value === "number"
              ? { numberValue: cell.value }
              : { stringValue: String(cell.value) };
          const userEnteredFormat: Record<string, unknown> = {
            textFormat: {
              foregroundColor:
                typeof cell.value === "string" && cell.value.trim().startsWith("=")
                  ? ROLE_TEXT_COLORS.formula
                  : cell.role
                  ? ROLE_TEXT_COLORS[cell.role]
                  : ROLE_TEXT_COLORS.formula,
              fontFamily: "Arial",
              fontSize: 11,
            },
          };
          if (banded) (userEnteredFormat as Record<string, unknown>).backgroundColor = BANDED_ROW_BG;
          if (fmt) (userEnteredFormat as Record<string, unknown>).numberFormat = { type: colType === "date" ? "DATE" : "NUMBER", pattern: fmt };
          const entry: Record<string, unknown> = { userEnteredValue, userEnteredFormat };
          if (cell.source) entry.note = cell.source;
          return entry;
        }),
      }));

      const requests = [{
        updateCells: {
          rows: rowRequests,
          fields: "userEnteredValue,userEnteredFormat,note",
          start: { sheetId, rowIndex: startRowIndex, columnIndex: 0 },
        },
      }];

      // Structural batchUpdate has no first-class Composio slug; use proxyExecute
      // to hit Google's real REST endpoint with our requests[] array.
      const batchRes = await composio.tools.proxyExecute({
        endpoint: `https://sheets.googleapis.com/v4/spreadsheets/${args.spreadsheet_id}:batchUpdate`,
        method: "POST",
        body: { requests },
        ...(connectedAccountId ? { connectedAccountId } : {}),
      });
      if (batchRes.status < 200 || batchRes.status >= 300) {
        const errData = batchRes.data as Record<string, unknown> | undefined;
        const googleErr = (errData?.error as { message?: string } | undefined)?.message;
        return {
          ok: false,
          error: `Sheets append failed (HTTP ${batchRes.status}): ${googleErr ?? JSON.stringify(errData ?? {}).slice(0, 300)}`,
        };
      }

      return {
        ok: true,
        data: { rowsAppended: args.rows.length, startRow: startRowIndex + 1, endRow: startRowIndex + args.rows.length },
      };
    } catch (e) {
      return { ok: false, error: `write_rows failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  },
};

registerTool(tool);
export default tool;
