// lib/agents/tools/india_gov/shared/client.ts
// Thin wrapper over api.data.gov.in. Handles BYO key lookup, caching,
// retries, and the 401-flagging path. Exports a small interface so a
// future microservice extraction is a one-line factory swap.

import { browserHeaders } from "@/lib/agents/tools/ib/shared/headers";
import { readCached, writeCached } from "@/lib/agents/tools/ib/shared/cache";
import { withRetry, type ResilientResult } from "@/lib/agents/tools/ib/shared/resilience";
import { getUserDataGovInKey, flagKeyNeedsRotation } from "./key-store";
import { visualizeUrlFor } from "./visualize-url";

const BASE = "https://api.data.gov.in";

export type DataGovInRecord = Record<string, unknown>;

export type DataGovInFetchResult = {
  title: string;
  records: DataGovInRecord[];
  totalCount: number;
  fields: Array<{ id: string; type: string; label?: string }>;
  sourceUrl: string;
  visualizeUrl: string | null;
  accessedAt: string;
  cacheHit: boolean;
  publisherLastUpdate: string | null;
};

type ResourcePayload = {
  title?: string;
  total?: number;
  count?: number;
  field?: Array<{ id: string; type: string; name?: string }>;
  records?: DataGovInRecord[];
  updated_date?: string;
};

export type CatalogResource = {
  resourceId: string;
  title: string;
  organization: string | null;
  sectors: string[];
  lastUpdated: string | null;
  recordCount: number | null;
  sourceUrl: string;
};

type CatalogPayload = {
  records?: Array<{
    resource_id?: string;
    title?: string;
    org?: string | string[];
    sector?: string | string[];
    updated_date?: string;
    count?: number;
    total?: number;
  }>;
};

export interface DataGovInClient {
  fetchResource(args: {
    userId: string;
    resourceId: string;
    limit?: number;
    offset?: number;
    filters?: Record<string, string | number>;
    fields?: string[];
    cacheTtlMs?: number;
  }): Promise<ResilientResult<DataGovInFetchResult>>;

  searchCatalog(args: {
    userId: string;
    query: string;
    limit?: number;
  }): Promise<ResilientResult<CatalogResource[]>>;
}

export const dataGovInClient: DataGovInClient = {
  async fetchResource(args) {
    const apiKey = await getUserDataGovInKey(args.userId);
    if (!apiKey) {
      return {
        ok: false,
        _warnings: [],
        error: "Configure your data.gov.in API key in /settings/data-gov-in",
      };
    }

    const limit = args.limit ?? 100;
    const offset = args.offset ?? 0;
    const filterEntries = Object.entries(args.filters ?? {});
    const fieldEntries = args.fields ?? [];
    const cacheKey = JSON.stringify({
      r: args.resourceId,
      l: limit,
      o: offset,
      f: filterEntries.sort(),
      g: fieldEntries.slice().sort(),
    });

    const cached = await readCached<DataGovInFetchResult>("datagov", cacheKey);
    if (cached) return { ok: true, _warnings: [], data: { ...cached, cacheHit: true } };

    const url = new URL(`${BASE}/resource/${args.resourceId}`);
    url.searchParams.set("api-key", apiKey);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(limit));
    if (offset > 0) url.searchParams.set("offset", String(offset));
    for (const [k, v] of filterEntries) {
      url.searchParams.set(`filters[${k}]`, String(v));
    }
    for (const f of fieldEntries) {
      url.searchParams.append("fields", f);
    }
    const sourceUrl = `https://data.gov.in/resource/${args.resourceId}`;

    const result = await withRetry(
      async () => {
        const res = await fetch(url.toString(), { headers: browserHeaders({ accept: "application/json" }) });
        if (res.status === 401) {
          await flagKeyNeedsRotation(args.userId);
          throw new Error("data.gov.in 401: API key invalid or revoked");
        }
        if (!res.ok) throw new Error(`data.gov.in ${res.status} ${res.statusText}`);
        return (await res.json()) as ResourcePayload;
      },
      { label: `datagov resource ${args.resourceId}` },
    );

    if (!result.ok) {
      return result;
    }

    const payload = result.data;
    const data: DataGovInFetchResult = {
      title: payload.title ?? args.resourceId,
      records: payload.records ?? [],
      totalCount: payload.total ?? payload.count ?? (payload.records?.length ?? 0),
      fields: (payload.field ?? []).map((f) => ({ id: f.id, type: f.type, label: f.name })),
      sourceUrl,
      visualizeUrl: visualizeUrlFor(args.resourceId),
      accessedAt: new Date().toISOString(),
      cacheHit: false,
      publisherLastUpdate: payload.updated_date ?? null,
    };

    const ttl = args.cacheTtlMs;
    await writeCached("datagov", cacheKey, data);
    if (ttl) {
      // ScrapedDataCache uses the source-default TTL; if a tighter or longer
      // override is needed in v1.1, extend the writeCached signature.
      void ttl;
    }
    return { ok: true, _warnings: result._warnings, data };
  },

  async searchCatalog(args) {
    const apiKey = await getUserDataGovInKey(args.userId);
    if (!apiKey) {
      return {
        ok: false,
        _warnings: [],
        error: "Configure your data.gov.in API key in /settings/data-gov-in",
      };
    }

    const limit = args.limit ?? 10;
    const cacheKey = JSON.stringify({ q: args.query, l: limit });
    const cached = await readCached<CatalogResource[]>("datagov", `catalog:${cacheKey}`);
    if (cached) return { ok: true, _warnings: [], data: cached };

    const url = new URL(`${BASE}/catalog`);
    url.searchParams.set("api-key", apiKey);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("q", args.query);

    const result = await withRetry(
      async () => {
        const res = await fetch(url.toString(), { headers: browserHeaders({ accept: "application/json" }) });
        if (res.status === 401) {
          await flagKeyNeedsRotation(args.userId);
          throw new Error("data.gov.in 401: API key invalid or revoked");
        }
        if (!res.ok) throw new Error(`data.gov.in catalog ${res.status} ${res.statusText}`);
        return (await res.json()) as CatalogPayload;
      },
      { label: `datagov catalog "${args.query}"` },
    );

    if (!result.ok) return result;

    const records = result.data.records ?? [];
    const out: CatalogResource[] = records.map((r) => ({
      resourceId: r.resource_id ?? "",
      title: r.title ?? "",
      organization: Array.isArray(r.org) ? r.org[0] ?? null : (r.org ?? null),
      sectors: Array.isArray(r.sector) ? r.sector : (r.sector ? [r.sector] : []),
      lastUpdated: r.updated_date ?? null,
      recordCount: r.count ?? r.total ?? null,
      sourceUrl: r.resource_id ? `https://data.gov.in/resource/${r.resource_id}` : "https://data.gov.in",
    }));
    await writeCached("datagov", `catalog:${cacheKey}`, out);
    return { ok: true, _warnings: result._warnings, data: out };
  },
};
