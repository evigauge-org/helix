// lib/agents/tools/sandbox/reaper.ts
import { prisma } from "@/lib/prisma";
import { listOpenSandboxes, closeRunSandbox } from "./registry";

const TERMINAL = new Set(["completed", "stopped", "expired", "aborted"]);

/**
 * Walks the in-memory open-sandbox list and kills any whose AgentRun
 * has reached a terminal status. Called by the daily Inngest cron.
 * Returns counts for telemetry.
 */
export async function reapLeakedSandboxes(): Promise<{ killed: number; remaining: number }> {
  const open = listOpenSandboxes();
  let killed = 0;
  for (const s of open) {
    const run = await prisma.agentRun.findUnique({
      where: { id: s.runId },
      select: { status: true },
    });
    if (run && TERMINAL.has(run.status)) {
      await closeRunSandbox(s.runId);
      killed++;
    }
  }
  return { killed, remaining: open.length - killed };
}
