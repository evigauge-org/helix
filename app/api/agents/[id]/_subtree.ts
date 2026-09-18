import { prisma } from "@/lib/prisma";

/**
 * Collect the full descendant subtree (including root) via BFS on parentAgentId.
 * Returns array of agent ids.
 */
export async function collectSubtreeIds(rootId: string): Promise<string[]> {
  const all: string[] = [rootId];
  let frontier: string[] = [rootId];
  while (frontier.length > 0) {
    const children = await prisma.agent.findMany({
      where: { parentAgentId: { in: frontier } },
      select: { id: true },
    });
    const childIds = children.map((c) => c.id);
    if (childIds.length === 0) break;
    all.push(...childIds);
    frontier = childIds;
  }
  return all;
}

export const NON_TERMINAL_STATUSES = ["pending", "running", "idle"];
