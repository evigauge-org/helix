// lib/agents/tools/ib/shared/resilience.ts
// Retries with exponential backoff. Returns { ok: false, _warnings } on
// terminal failure so callers can degrade to web_search + LLM extraction.

export type ResilientResult<T> =
  | { ok: true; data: T; _warnings: string[] }
  | { ok: false; _warnings: string[]; error: string };

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: { attempts?: number; baseDelayMs?: number; label?: string },
): Promise<ResilientResult<T>> {
  const attempts = opts?.attempts ?? 3;
  const baseDelay = opts?.baseDelayMs ?? 500;
  const label = opts?.label ?? "fetch";
  const warnings: string[] = [];
  let lastErr: unknown = null;

  for (let i = 0; i < attempts; i++) {
    try {
      const data = await fn();
      return { ok: true, data, _warnings: warnings };
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push(`${label} attempt ${i + 1} failed: ${msg}`);
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, i)));
      }
    }
  }

  return {
    ok: false,
    _warnings: warnings,
    error: lastErr instanceof Error ? lastErr.message : String(lastErr),
  };
}
