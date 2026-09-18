// lib/agents/tools/ib/shared/cache.ts
// Per-source TTL cache backed by ScrapedDataCache. Use for any HTML-scraped
// or rate-limited JSON response so we don't spam upstream sources.

import { prisma } from "@/lib/prisma";

const TTL_MS_BY_SOURCE: Record<string, number> = {
  edgar: 24 * 60 * 60 * 1000,         // 24h — filings are append-only
  yahoo: 1 * 60 * 60 * 1000,          //  1h — quotes change fast
  crunchbase: 24 * 60 * 60 * 1000,
  macrotrends: 24 * 60 * 60 * 1000,
  datagov: 24 * 60 * 60 * 1000, // default 24h; curated wrappers can pass a per-call override in v1.1
};

export async function readCached<T>(source: string, key: string): Promise<T | null> {
  const row = await prisma.scrapedDataCache.findUnique({
    where: { source_key: { source, key } },
  });
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return row.payload as T;
}

export async function writeCached(source: string, key: string, payload: unknown, etag?: string): Promise<void> {
  const ttl = TTL_MS_BY_SOURCE[source] ?? 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttl);
  await prisma.scrapedDataCache.upsert({
    where: { source_key: { source, key } },
    create: { source, key, payload: payload as never, etag, expiresAt },
    update: { payload: payload as never, etag, expiresAt, fetchedAt: new Date() },
  });
}
