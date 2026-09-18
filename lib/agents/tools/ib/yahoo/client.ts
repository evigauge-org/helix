// lib/agents/tools/ib/yahoo/client.ts
import { browserHeaders } from "../shared/headers";
import { readCached, writeCached } from "../shared/cache";
import { withRetry } from "../shared/resilience";

const Q1 = "https://query1.finance.yahoo.com";

export async function quote<T>(symbol: string): Promise<T> {
  const key = `yahoo:quote:${symbol}`;
  const cached = await readCached<T>("yahoo", key);
  if (cached) return cached;
  const url = `${Q1}/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
  const result = await withRetry(async () => {
    const res = await fetch(url, { headers: browserHeaders({ accept: "application/json" }) });
    if (!res.ok) throw new Error(`yahoo ${res.status} ${url}`);
    return (await res.json()) as T;
  }, { label: `yahoo quote ${symbol}` });
  if (!result.ok) throw new Error(result.error);
  await writeCached("yahoo", key, result.data);
  return result.data;
}

export async function quoteSummary<T>(symbol: string, modules: string[]): Promise<T> {
  const m = modules.join(",");
  const key = `yahoo:summary:${symbol}:${m}`;
  const cached = await readCached<T>("yahoo", key);
  if (cached) return cached;
  const url = `${Q1}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${encodeURIComponent(m)}`;
  const result = await withRetry(async () => {
    const res = await fetch(url, { headers: browserHeaders({ accept: "application/json" }) });
    if (!res.ok) throw new Error(`yahoo ${res.status} ${url}`);
    return (await res.json()) as T;
  }, { label: `yahoo summary ${symbol}` });
  if (!result.ok) throw new Error(result.error);
  await writeCached("yahoo", key, result.data);
  return result.data;
}
