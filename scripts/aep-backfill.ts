// scripts/aep-backfill.ts
//
// Idempotent backfill: gives every legacy Agent / AgentRun / AgentArtifact /
// AgentMessage row an AEP identity. Re-running is safe — rows that already
// have an `aepId` are skipped via the `where: { aepId: null }` filter.
//
// Run with: bunx tsx scripts/aep-backfill.ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { ulid } from "ulid";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL ?? "") });

async function main() {
  // Agents
  const agents = await prisma.agent.findMany({ where: { aepId: null } as any });
  for (const a of agents) {
    const aepId = `agt_${ulid()}`;
    await prisma.agent.update({
      where: { id: a.id },
      data: {
        aepId,
        rootAgentId: (a as any).rootAgentId ?? aepId,
        toolset: (a as any).toolset?.length ? (a as any).toolset : a.toolSlugs.map((s: string) => `helix.${s}`),
        constitutionImmutable: (a as any).constitutionImmutable ?? null,
        constitutionMutable: (a as any).constitutionMutable ?? a.systemPromptExtra,
      } as any,
    });
    console.log(`[agent] backfilled ${a.id} -> ${aepId}`);
  }

  // Runs
  const runs = await prisma.agentRun.findMany({ where: { aepId: null } as any });
  for (const r of runs) {
    await prisma.agentRun.update({
      where: { id: r.id },
      data: { aepId: `run_${ulid()}`, aepState: mapLegacyStatus(r.status) } as any,
    });
    console.log(`[run] backfilled ${r.id}`);
  }

  // Artifacts
  const arts = await prisma.agentArtifact.findMany({ where: { aepId: null } as any });
  for (const art of arts) {
    await prisma.agentArtifact.update({
      where: { id: art.id },
      data: {
        aepId: `art_${ulid()}`,
        sizeBytes: art.content ? Buffer.byteLength(art.content, "utf8") : 0,
      } as any,
    });
    console.log(`[artifact] backfilled ${art.id}`);
  }

  // Messages — depends on agents being backfilled first so `from.rootAgentId`
  // is the aepId, not a legacy cuid.
  const msgs = await prisma.agentMessage.findMany({ where: { aepId: null } as any });
  for (const m of msgs) {
    const from = await prisma.agent.findUnique({ where: { id: m.fromAgentId } });
    await prisma.agentMessage.update({
      where: { id: m.id },
      data: { aepId: `msg_${ulid()}`, treeRootId: from?.rootAgentId ?? null } as any,
    });
    console.log(`[message] backfilled ${m.id}`);
  }

  console.log(
    `Backfill complete. agents=${agents.length} runs=${runs.length} artifacts=${arts.length} messages=${msgs.length}`,
  );
}

function mapLegacyStatus(s: string): "running" | "sleeping" | "complete" | "cancelled" | "error" {
  switch (s) {
    case "active":
    case "pending":
      return "running";
    case "idle":
      return "sleeping";
    case "completed":
      return "complete";
    case "stopped":
    case "aborted":
    case "expired":
      return "cancelled";
    default:
      return "error";
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
