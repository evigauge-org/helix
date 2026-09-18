import { prisma } from "@/lib/prisma";

const MODS_PER_24H_CAP = 10;

export async function checkSelfModAllowed(agentId: string): Promise<{ allowed: true } | { allowed: false; error: string }> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { selfModLocked: true, deletedAt: true },
  });
  if (!agent) return { allowed: false, error: "agent not found" };
  if (agent.deletedAt) return { allowed: false, error: "agent deleted" };
  if (agent.selfModLocked) return { allowed: false, error: "self-mod halted by user" };

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.agentModification.count({
    where: { agentId, createdAt: { gt: dayAgo } },
  });
  if (recent >= MODS_PER_24H_CAP) {
    return { allowed: false, error: `self-mod rate limit: ${MODS_PER_24H_CAP}/24h` };
  }
  return { allowed: true };
}

export async function recordModification(params: {
  agentId: string;
  tickNumber: number;
  tool: string;
  before: unknown;
  after: unknown;
}) {
  await prisma.agentModification.create({
    data: {
      agentId: params.agentId,
      tickNumber: params.tickNumber,
      tool: params.tool,
      before: (params.before ?? null) as never,
      after: (params.after ?? null) as never,
    },
  });
}

export async function snapshotAgent(agentId: string) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) return;
  await prisma.agentVersion.create({
    data: { agentId, snapshot: agent as unknown as object },
  });
}
