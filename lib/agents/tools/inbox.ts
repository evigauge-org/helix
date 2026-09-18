// lib/agents/tools/inbox.ts
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { emitAepEvent } from "@/lib/aep/events";
import type { ToolDef, ToolContext, ToolResult } from "../types";

const schema = z.object({});

export const inboxReadTool: ToolDef = {
  slug: "inbox_read",
  description: "Read unread messages addressed to this agent. Marks them as read and delivered.",
  schema,
  async execute(ctx: ToolContext, _rawArgs: unknown): Promise<ToolResult> {
    const unread = await prisma.agentMessage.findMany({
      where: { toAgentId: ctx.agentId, readAt: null },
      orderBy: { createdAt: "asc" },
      include: { fromAgent: true },
    });
    if (unread.length === 0) return { ok: true, data: { messages: [] } };

    const now = new Date();
    await prisma.agentMessage.updateMany({
      where: { id: { in: unread.map(m => m.id) } },
      data: { readAt: now, deliveredAt: now },
    });
    for (const m of unread) {
      await emitAepEvent(ctx.runId, "message.delivered", { from_agent_id: m.fromAgent?.aepId ?? m.fromAgentId, message_id: m.aepId });
    }
    return {
      ok: true,
      data: {
        messages: unread.map(m => ({
          id: m.aepId,
          from_agent_id: m.fromAgent?.aepId ?? m.fromAgentId,
          body: m.aepBody ?? { text: m.body },
          sent_at: m.createdAt.toISOString(),
        })),
      },
    };
  },
};
