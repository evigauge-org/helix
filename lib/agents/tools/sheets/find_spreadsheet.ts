// lib/agents/tools/sheets/find_spreadsheet.ts
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
  nameQuery: z.string().min(1).max(200),
});

const tool: ToolDef<typeof schema> = {
  slug: "find_spreadsheet",
  description:
    "Find Google Sheets in the user's Drive by name (substring match). Use this when the user references a sheet by name in their message (e.g. \"my Companies sheet\", \"the Q1 Pipeline sheet\") instead of pasting a URL. Returns up to 10 matches as { id, name, modifiedTime, url }. After calling this, pass the chosen id to get_spreadsheet. If zero matches, tell the user. If multiple, ask the user which one.",
  schema,
  async execute(ctx, { nameQuery }) {
    try {
      // Resolve connected Sheets account (OAuth scope includes Drive metadata).
      const conns = await composio.connectedAccounts.list({
        userIds: [ctx.userId],
        authConfigIds: [SHEETS_AUTH_CONFIG_ID],
        statuses: ["ACTIVE"],
      });
      const list = extractList(conns);
      if (list.length === 0) {
        return { ok: false, error: "Google Sheets not connected. Ask the user to connect it at /integrations." };
      }
      const connectedAccountId = (list[0].id ?? list[0].connectedAccountId) as string | undefined;

      // Escape single quotes per Drive API v3:
      // https://developers.google.com/drive/api/v3/ref-search-terms#search-string-formatting
      const safeName = nameQuery.replace(/'/g, "\\'");
      const q = `mimeType='application/vnd.google-apps.spreadsheet' and name contains '${safeName}' and trashed=false`;
      const params = new URLSearchParams({
        q,
        pageSize: "25",
        fields: "files(id,name,modifiedTime)",
        orderBy: "modifiedTime desc",
      });

      const res = await composio.tools.proxyExecute({
        endpoint: `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
        method: "GET",
        ...(connectedAccountId ? { connectedAccountId } : {}),
      });

      if (res.status < 200 || res.status >= 300) {
        const errData = res.data as Record<string, unknown> | undefined;
        const apiErr = (errData?.error as { message?: string } | undefined)?.message;
        return {
          ok: false,
          error: `Drive search failed (HTTP ${res.status}): ${apiErr ?? JSON.stringify(errData ?? {}).slice(0, 300)}`,
        };
      }

      const data = res.data as { files?: { id: string; name: string; modifiedTime: string }[] };
      const files = (data?.files ?? []).slice(0, 10);
      const matches = files.map((f) => ({
        id: f.id,
        name: f.name,
        modifiedTime: f.modifiedTime,
        url: `https://docs.google.com/spreadsheets/d/${f.id}/edit`,
      }));

      return { ok: true, data: { matches } };
    } catch (e) {
      return { ok: false, error: `find_spreadsheet failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  },
};

registerTool(tool);
export default tool;
