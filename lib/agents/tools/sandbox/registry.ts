// lib/agents/tools/sandbox/registry.ts
import type { Sandbox } from "@e2b/code-interpreter";
import { bootSandbox } from "./client";

type Entry = {
  promise: Promise<Sandbox>;
  bornAt: Date;
  sandboxId?: string; // resolved after boot
};

// Process-level Map. Each Inngest worker process has its own. A run that
// hops workers (multi-tick across workers) will boot a fresh sandbox on
// the new worker — documented v1.1 limitation; cross-worker reconnect
// requires persisting sandbox-id to AgentRun and using Sandbox.connect.
const sandboxesByRun = new Map<string, Entry>();

/**
 * Returns an existing sandbox for this run, or boots one. Idempotent under
 * concurrent calls because the Map stores the boot Promise (not the
 * resolved Sandbox), so two callers racing the boot await the same promise.
 */
export async function getOrCreateRunSandbox(runId: string): Promise<Sandbox> {
  const existing = sandboxesByRun.get(runId);
  if (existing) return existing.promise;

  const promise = bootSandbox();
  const entry: Entry = { promise, bornAt: new Date() };
  sandboxesByRun.set(runId, entry);

  // Best-effort: stash the sandbox id once the boot resolves. This is for
  // the reaper's listOpenSandboxes() debug view — not used for correctness.
  promise
    .then((sandbox) => {
      const id = (sandbox as unknown as { sandboxID?: string; id?: string }).sandboxID
        ?? (sandbox as unknown as { id?: string }).id;
      if (id) entry.sandboxId = id;
    })
    .catch(() => {
      // Boot failed — drop the entry so the next call retries.
      sandboxesByRun.delete(runId);
    });

  return promise;
}

/**
 * Called by runner.ts in the try/finally at run completion. No-op if
 * the run never booted a sandbox. Swallows kill errors (best-effort
 * cleanup; reaper is the safety net).
 */
export async function closeRunSandbox(runId: string): Promise<void> {
  const entry = sandboxesByRun.get(runId);
  if (!entry) return;
  sandboxesByRun.delete(runId);
  try {
    const sandbox = await entry.promise;
    await sandbox.kill();
  } catch {
    // ignore — sandbox may have died already, or kill itself raises;
    // E2B's idle-timeout reaper will catch it within ~10 min if so.
  }
}

/**
 * Debug / reaper view of currently-tracked sandboxes.
 */
export function listOpenSandboxes(): Array<{ runId: string; bornAt: Date; sandboxId?: string }> {
  return Array.from(sandboxesByRun.entries()).map(([runId, e]) => ({
    runId,
    bornAt: e.bornAt,
    sandboxId: e.sandboxId,
  }));
}
