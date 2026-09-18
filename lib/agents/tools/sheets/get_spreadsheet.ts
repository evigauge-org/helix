import { z } from "zod";
import { registerTool } from "../../tool-registry";
import type { ToolDef } from "../../types";
import { composio, SHEETS_AUTH_CONFIG_ID } from "@/lib/composio";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractList(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (v?.items && Array.isArray(v.items)) return v.items;
  if (v?.data && Array.isArray(v.data)) return v.data;
  return [];
}

const schema = z.object({
  spreadsheet_id: z.string(),
  sheet_name: z.string().optional(),
  range: z.string().optional(),
});

const tool: ToolDef<typeof schema> = {
  slug: "get_spreadsheet",
  description: "Read a Google Sheet's structure and sample values. Returns tab names, column headers, and up to 20 sample rows per tab. Use before write_rows or to summarize prior work.",
  schema,
  async execute(ctx, args) {
    try {
      const connections = await composio.connectedAccounts.list({
        userIds: [ctx.userId],
        authConfigIds: [SHEETS_AUTH_CONFIG_ID],
        statuses: ["ACTIVE"],
      });
      if (extractList(connections).length === 0) {
        return { ok: false, error: "Google Sheets not connected." };
      }

      const metaRes = await composio.tools.execute("GOOGLESHEETS_GET_SPREADSHEET_INFO", {
        userId: ctx.userId,
        arguments: { spreadsheet_id: args.spreadsheet_id },
        dangerouslySkipVersionCheck: true,
      });
      if (!metaRes.successful) return { ok: false, error: `Sheets get failed: ${metaRes.error ?? "unknown"}` };
      const meta = metaRes.data as Record<string, unknown>;
      const resp = (meta?.response_data as Record<string, unknown>) ?? meta;
      const title = (resp?.properties && (resp.properties as Record<string, unknown>).title) ? String((resp.properties as Record<string, unknown>).title) : "";
      const rawSheets = (resp?.sheets as Array<{ properties?: { title?: string; sheetId?: number } }>) ?? [];
      const targetSheets = args.sheet_name
        ? rawSheets.filter((s) => s.properties?.title === args.sheet_name)
        : rawSheets;

      const ranges = targetSheets.map((s) => args.range ? `${s.properties!.title}!${args.range}` : `${s.properties!.title}!A1:Z21`);
      const valuesRes = await composio.tools.execute("GOOGLESHEETS_BATCH_GET", {
        userId: ctx.userId,
        arguments: { spreadsheet_id: args.spreadsheet_id, ranges },
        dangerouslySkipVersionCheck: true,
      });
      const valuesData = valuesRes.data as Record<string, unknown>;
      const valueRanges = (valuesData?.valueRanges ?? (valuesData?.response_data as Record<string, unknown>)?.valueRanges) as Array<{ values?: Array<Array<string | number | null>> }> | undefined;

      const out = targetSheets.map((s, i) => {
        const values = valueRanges?.[i]?.values ?? [];
        const headers = values[0] ?? [];
        const sampleRows = values.slice(1, 21);
        return {
          name: s.properties!.title!,
          column_headers: headers.map((h) => String(h ?? "")),
          sample_rows: sampleRows,
          row_count: values.length,
        };
      });

      return { ok: true, data: { title, sheets: out } };
    } catch (e) {
      return { ok: false, error: `get_spreadsheet failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  },
};

registerTool(tool);
export default tool;
