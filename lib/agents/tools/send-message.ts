// lib/agents/tools/send-message.ts
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { newAepId } from "@/lib/aep/ids";
import { emitAepEvent } from "@/lib/aep/events";
import type { ToolDef, ToolContext, ToolResult } from "../types";

const schema = z.object({
  to_agent_id: z.string(),        // AEP id, "agt_..."
  body: z.unknown(),
});

export const sendMessageTool: ToolDef = {
  slug: "send_message",
  description: "Send a message to another agent in the same tree. Async delivery; recipient sees it on inbox_read.",
  schema,
  async execute(ctx: ToolContext, rawArgs: unknown): Promise<ToolResult> {
    const args = schema.parse(rawArgs);
    const self = await prisma.agent.findUnique({ where: { id: ctx.agentId } });
    const recipient = await prisma.agent.findFirst({ where: { aepId: args.to_agent_id } });
    if (!self || !recipient) return { ok: false, error: "agent not found" };
    if (self.rootAgentId !== recipient.rootAgentId) {
      return { ok: false, error: "tree_boundary_violation: recipient not in same tree" };
    }
    const msg = await prisma.agentMessage.create({
      data: {
        aepId: newAepId("msg"),
        fromAgentId: self.id,
        toAgentId: recipient.id,
        treeRootId: self.rootAgentId,
        body: typeof args.body === "string" ? args.body : JSON.stringify(args.body),
        aepBody: args.body as any,
      },
    });

    await emitAepEvent(ctx.runId, "message.sent", { to_agent_id: recipient.aepId, message_id: msg.aepId });

    // Wake-on-message: if the recipient has a sleeping run, fire its next tick immediately.
    const sleepingRun = await prisma.agentRun.findFirst({
      where: { agentId: recipient.id, aepState: "sleeping" },
      orderBy: { startedAt: "desc" },
    });
    if (sleepingRun) {
      await prisma.agentRun.update({
        where: { id: sleepingRun.id },
        data: { aepState: "running", status: "pending", nextWakeAt: null },
      });
      await inngest.send({ name: "agent/run.tick", data: { runId: sleepingRun.id } });
    }
    return { ok: true, data: { message_id: msg.aepId } };
  },
};
