// inngest/sandbox-reaper.ts
import { inngest } from "./client";
import { reapLeakedSandboxes } from "@/lib/agents/tools/sandbox/reaper";

/**
 * Daily reaper at 03:00 UTC. Belt-and-suspenders for the case where a
 * worker process crashed mid-run and the runner.ts try/finally never
 * called closeRunSandbox. E2B's own ~10-minute idle timeout is the
 * primary safety net — this cron just cleans the in-memory Map entries
 * for sandboxes whose AgentRun is already terminal.
 */
export const sandboxReaper = inngest.createFunction(
  {
    id: "sandbox-reaper",
    retries: 1,
    triggers: [{ cron: "0 3 * * *" }],
  },
  async ({ step }) => {
    const result = await step.run("reap-leaked-sandboxes", async () => reapLeakedSandboxes());
    return result;
  },
);
