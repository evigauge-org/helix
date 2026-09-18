import { z } from "zod";
import { registerTool } from "../tool-registry";
import type { ToolDef } from "../types";
import { composio } from "@/lib/composio";

const emailList = z.union([
  z.string().email(),
  z.array(z.string().email()).min(1).max(50),
]);

const schema = z.object({
  to: emailList,
  cc: emailList.optional(),
  bcc: emailList.optional(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(50000),
  html: z.string().max(100000).optional(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractList(connections: any): any[] {
  if (Array.isArray(connections)) return connections;
  if (connections?.items && Array.isArray(connections.items)) return connections.items;
  if (connections?.data && Array.isArray(connections.data)) return connections.data;
  if (connections?.connectedAccounts && Array.isArray(connections.connectedAccounts)) return connections.connectedAccounts;
  return [];
}

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

const tool: ToolDef<typeof schema> = {
  slug: "send_email",
  requiresApproval: true,
  description:
    "Send an email from the user's connected Gmail. Requires Gmail connected at /integrations. " +
    "Supports multiple recipients via an array: pass `to: ['a@x.com', 'b@y.com']` to send the same email to each recipient individually (one message per person, not a group thread). " +
    "`cc` and `bcc` may also be strings or arrays and are applied to every outgoing message. " +
    "Plain-text body by default; if `html` is provided it is used instead. " +
    "Returns { sent, failed, results[{ recipient, messageId?, error? }] }.",
  schema,
  async execute(ctx, { to, cc, bcc, subject, body, html }) {
    const authConfigId = process.env.COMPOSIO_GMAIL_AUTH_CONFIG_ID;
    if (!authConfigId) {
      return { ok: false, error: "COMPOSIO_GMAIL_AUTH_CONFIG_ID not configured" };
    }

    const connections = await composio.connectedAccounts.list({
      userIds: [ctx.userId],
      authConfigIds: [authConfigId],
      statuses: ["ACTIVE"],
    });
    if (extractList(connections).length === 0) {
      return {
        ok: false,
        error: "Gmail not connected. The user must connect Gmail at /integrations first.",
      };
    }

    const toRecipients = toArray(to);
    const ccList = toArray(cc);
    const bccList = toArray(bcc);
    const isHtml = typeof html === "string" && html.length > 0;
    const payloadBody = isHtml ? html : body;

    const results: Array<{ recipient: string; messageId: string | null; error?: string }> = [];

    for (const recipient of toRecipients) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args: Record<string, any> = {
          recipient_email: recipient,
          subject,
          body: payloadBody,
          is_html: isHtml,
        };
        if (ccList.length > 0) args.cc = ccList;
        if (bccList.length > 0) args.bcc = bccList;

        const result = await composio.tools.execute("GMAIL_SEND_EMAIL", {
          userId: ctx.userId,
          arguments: args,
          dangerouslySkipVersionCheck: true,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = result as any;
        if (r && r.successful === false) {
          results.push({ recipient, messageId: null, error: r.error ?? "Gmail send failed" });
          continue;
        }
        const messageId =
          r?.data?.response_data?.id ??
          r?.data?.id ??
          r?.data?.messageId ??
          null;
        results.push({ recipient, messageId });
      } catch (err) {
        results.push({
          recipient,
          messageId: null,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const sent = results.filter((r) => !r.error).length;
    const failed = results.length - sent;

    // Surface an error if every recipient failed so the agent sees the failure clearly.
    if (sent === 0 && failed > 0) {
      return {
        ok: false,
        error: `All ${failed} sends failed. First error: ${results[0].error ?? "unknown"}`,
        data: { sent, failed, results },
      };
    }

    return { ok: true, data: { sent, failed, results } };
  },
};

registerTool(tool);
export default tool;
