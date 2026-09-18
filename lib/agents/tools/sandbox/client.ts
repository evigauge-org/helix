// lib/agents/tools/sandbox/client.ts
import { Sandbox } from "@e2b/code-interpreter";

/**
 * Read the E2B API key from env. Returns null when unset; callers MUST
 * handle the null path gracefully (return a config-error tool result),
 * not throw — the app must boot fine without an E2B account configured.
 */
export function getE2BApiKey(): string | null {
  const k = process.env.E2B_API_KEY;
  if (!k || k.trim().length === 0) return null;
  return k.trim();
}

/**
 * Boot a new sandbox using the configured API key. Throws if no key.
 * Callers should wrap in try/catch and convert to a tool-result error.
 */
export async function bootSandbox(): Promise<Sandbox> {
  const apiKey = getE2BApiKey();
  if (!apiKey) throw new Error("E2B_API_KEY not configured");
  return Sandbox.create({ apiKey });
}
