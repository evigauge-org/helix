// lib/aep/handlers/message.ts
import { prisma } from "@/lib/prisma";
import { AepError } from "../errors";
import type { AepContext } from "../context";

export async function messageList(
  params: { agent_id?: string; tree_root_id?: string; cursor?: string; limit?: number },
  ctx: AepContext,
) {
  const take = Math.min(params.limit ?? 50, 200);
  const where: any = {
    OR: [
      { fromAgent: { userId: ctx.userId } },
      { toAgent: { userId: ctx.userId } },
    ],
  };
  if (params.agent_id) {
    where.OR = [
      { fromAgent: { aepId: params.agent_id } },
      { toAgent: { aepId: params.agent_id } },
    ];
  }
  if (params.tree_root_id) where.treeRootId = params.tree_root_id;

  const rows = await prisma.agentMessage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(params.cursor ? { cursor: { aepId: params.cursor }, skip: 1 } : {}),
    include: { fromAgent: true, toAgent: true },
  });
  const next_cursor = rows.length > take ? rows[take - 1].aepId : null;
  return { messages: rows.slice(0, take).map(serializeMessage), next_cursor };
}

export async function messageSendEmbedder() {
  throw new AepError("authz_denied", "Embedders MAY NOT send messages on behalf of agents. Use the agent-facing tool.");
}
export async function messageInboxEmbedder() {
  throw new AepError("authz_denied", "Embedders MAY NOT read an agent's inbox. Use the agent-facing tool.");
}

function serializeMessage(m: any) {
  return {
    id: m.aepId,
    from_agent_id: m.fromAgent?.aepId ?? m.fromAgentId,
    to_agent_id: m.toAgent?.aepId ?? m.toAgentId,
    tree_root_id: m.treeRootId,
    body: m.aepBody ?? { text: m.body },
    sent_at: m.createdAt.toISOString(),
    delivered_at: m.deliveredAt?.toISOString() ?? null,
    read_at: m.readAt?.toISOString() ?? null,
  };
}
