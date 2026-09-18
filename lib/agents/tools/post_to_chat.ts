import { z } from "zod";
import { registerTool } from "../tool-registry";
import type { ToolDef } from "../types";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  markdown: z.string().min(1).max(20000),
});

const tool: ToolDef<typeof schema> = {
  slug: "post_to_chat",
  requiresApproval: true,
  description:
    "Post a message back into the chat session that created this agent. Use to deliver progress or final results to the user's chat UI. Silently no-ops if no origin chat is set.",
  schema,
  async execute(ctx, { markdown }) {
    const agent = await prisma.agent.findUnique({
      where: { id: ctx.agentId },
      select: { createdInChatId: true },
    });
    if (!agent?.createdInChatId) return { ok: true, data: { skipped: "no origin chat" } };

    const chat = await prisma.chatSession.findUnique({
      where: { id: agent.createdInChatId },
      select: { userId: true },
    });
    if (!chat || chat.userId !== ctx.userId) {
      return { ok: false, error: "chat session not found or not owned" };
    }

    const msg = await prisma.chatMessage.create({
      data: {
        chatSessionId: agent.createdInChatId,
        role: "assistant",
        content: markdown,
        metadata: {
          tier: 0,
          success: true,
          answer: markdown,
          conversation_mode: true,
          agent_post: { agentId: ctx.agentId, runId: ctx.runId },
        },
      },
    });
    return { ok: true, data: { messageId: msg.id } };
  },
};

registerTool(tool);
export default tool;
