import { Agent, setGlobalDispatcher } from "undici";

let installed = false;

export function installGlobalDispatcher(): void {
  if (installed) return;
  installed = true;
  setGlobalDispatcher(
    new Agent({
      // Keep the TCP connect timeout tight — if we can't reach the server at
      // all, fail fast. User's ISP flakes on Cloudflare; 60s is their ceiling.
      connect: { timeout: 60_000 },
      // Response-phase timeouts are ceilings for slow-running backends
      // (Composio proxies, long LLM calls). Set to 30 min so per-call
      // AbortController timeouts are the effective ceiling, not the dispatcher.
      headersTimeout: 30 * 60_000,
      bodyTimeout: 30 * 60_000,
      keepAliveTimeout: 30_000,
      keepAliveMaxTimeout: 600_000,
    }),
  );
}
