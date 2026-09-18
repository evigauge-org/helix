// lib/agents/tools/ib/sec_edgar/client.ts
// Thin wrapper over data.sec.gov + www.sec.gov. Caches everything via
// readCached/writeCached.

import { secEdgarHeaders } from "../shared/headers";
import { readCached, writeCached } from "../shared/cache";
import { withRetry } from "../shared/resilience";

const DATA_SEC = "https://data.sec.gov";
const WWW_SEC = "https://www.sec.gov";

export async function getJson<T>(path: string, cacheKey: string): Promise<T> {
  const cached = await readCached<T>("edgar", cacheKey);
  if (cached) return cached;

  const url = path.startsWith("http") ? path : `${DATA_SEC}${path}`;
  const result = await withRetry(
    async () => {
      const res = await fetch(url, { headers: secEdgarHeaders() });
      if (!res.ok) throw new Error(`EDGAR ${res.status} ${url}`);
      return (await res.json()) as T;
    },
    { label: `edgar GET ${path}` },
  );
  if (!result.ok) throw new Error(result.error);

  await writeCached("edgar", cacheKey, result.data);
  return result.data;
}

export async function getText(path: string, cacheKey: string): Promise<string> {
  const cached = await readCached<{ text: string }>("edgar", cacheKey);
  if (cached) return cached.text;

  const url = path.startsWith("http") ? path : `${WWW_SEC}${path}`;
  const result = await withRetry(
    async () => {
      const res = await fetch(url, { headers: secEdgarHeaders() });
      if (!res.ok) throw new Error(`EDGAR ${res.status} ${url}`);
      return await res.text();
    },
    { label: `edgar GET text ${path}` },
  );
  if (!result.ok) throw new Error(result.error);

  await writeCached("edgar", cacheKey, { text: result.data });
  return result.data;
}

// SEC requires CIKs as 10-digit zero-padded strings in some endpoints.
export function padCik(cik: string | number): string {
  return String(cik).replace(/^CIK/, "").padStart(10, "0");
}
