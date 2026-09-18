import { z } from "zod";
import { registerTool } from "../../tool-registry";
import type { ToolDef } from "../../types";
import { prisma } from "@/lib/prisma";
import { sanitizeDashboard } from "@/lib/agents/dashboards/sanitize";

const MAX_BYTES_AFTER_SANITIZE = 200_000;

const schema = z.object({
  body_html: z.string().min(1).max(200_000),
  title: z.string().min(1).max(200).optional(),
});

const tool: ToolDef<typeof schema> = {
  slug: "update_dashboard",
  requiresApproval: true,
  description:
    "Render or update the user-facing dashboard for this agent. REQUIRED argument: body_html (string) — the inner BODY HTML only, no <html>/<head>/<body> tags. OPTIONAL: title (string). The server wraps body_html in Helix's enforced shell (Inter font, white+blue palette, navy headers, Chart.js v4 already loaded). Example call: { body_html: \"<h1>Status</h1><div class='kpi-grid'>...</div>\", title: \"Silver Monitor\" }. Use the conventions class names (kpi-grid, kpi-card, data-table, chart-container, badge) for polish. Call ONCE per cycle AFTER producing data.",
  schema,
  async execute(ctx, { body_html, title }) {
    const cleaned = sanitizeDashboard(body_html);
    if (!cleaned || cleaned.trim().length === 0) {
      return {
        ok: false,
        error: "all dashboard content was sanitized away — check for blocked tags/scripts",
      };
    }
    const bytes = Buffer.byteLength(cleaned, "utf8");
    if (bytes > MAX_BYTES_AFTER_SANITIZE) {
      return {
        ok: false,
        error: `dashboard body too large after sanitization (${bytes} > ${MAX_BYTES_AFTER_SANITIZE} bytes)`,
      };
    }
    const finalTitle = (title ?? "").trim() || `Agent ${ctx.agentId.slice(0, 8)}`;
    try {
      await prisma.agentDashboard.upsert({
        where: { agentId: ctx.agentId },
        update: { bodyHtml: cleaned, title: finalTitle },
        create: { agentId: ctx.agentId, bodyHtml: cleaned, title: finalTitle },
      });
      return {
        ok: true,
        data: { url: `/agents/${ctx.agentId}/dashboard`, bytes },
      };
    } catch (e) {
      return {
        ok: false,
        error: `update_dashboard failed: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  },
};

registerTool(tool);
export default tool;
