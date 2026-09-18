// lib/agents/tools/insurance/shared/pdf-fetch.ts
// Streams a PDF URL → InsuranceFactsheetCache.pdfBytes. Returns the cache row's id.
// Caller handles dedupe via the @@unique([insurerSlug, monthYyyymm]) constraint.

import { prisma } from "@/lib/prisma";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { browserHeaders } from "@/lib/agents/tools/ib/shared/headers";
import { withRetry } from "@/lib/agents/tools/ib/shared/resilience";
import type { FactsheetMeta } from "./types";

export type DownloadAndCacheArgs = {
  insurerSlug: string;
  insurerDisplay: string;
  monthLabel: string;
  monthYyyymm: string;
  pdfUrl: string;
  source: "catalog" | "fallback";
};

export async function downloadAndCache(args: DownloadAndCacheArgs): Promise<FactsheetMeta> {
  // 1. Cache hit?
  const existing = await prisma.insuranceFactsheetCache.findUnique({
    where: { insurerSlug_monthYyyymm: { insurerSlug: args.insurerSlug, monthYyyymm: args.monthYyyymm } },
  });
  if (existing) {
    return {
      cacheId: existing.id,
      insurer: args.insurerDisplay,
      insurerSlug: existing.insurerSlug,
      monthLabel: existing.monthLabel,
      monthYyyymm: existing.monthYyyymm,
      pdfUrl: existing.pdfUrl,
      sizeKb: existing.sizeKb,
      pageCount: existing.pageCount,
      source: existing.source as "catalog" | "fallback",
      fromCache: true,
    };
  }

  // 2. HEAD-check content type (cheap pre-flight; some sites redirect to HTML)
  const headResult = await withRetry(
    async () => {
      const res = await fetch(args.pdfUrl, { method: "HEAD", headers: browserHeaders() });
      if (!res.ok) throw new Error(`HEAD ${res.status} ${args.pdfUrl}`);
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("pdf") && !args.pdfUrl.toLowerCase().endsWith(".pdf")) {
        throw new Error(`URL is not a PDF (content-type=${ct}): ${args.pdfUrl}`);
      }
      return ct;
    },
    { label: `factsheet HEAD ${args.insurerSlug} ${args.monthYyyymm}` },
  );
  if (!headResult.ok) throw new Error(headResult.error);

  // 3. Stream-download bytes
  const dlResult = await withRetry(
    async () => {
      const res = await fetch(args.pdfUrl, { headers: browserHeaders() });
      if (!res.ok) throw new Error(`GET ${res.status} ${args.pdfUrl}`);
      return Buffer.from(await res.arrayBuffer());
    },
    { label: `factsheet GET ${args.insurerSlug} ${args.monthYyyymm}` },
  );
  if (!dlResult.ok) throw new Error(dlResult.error);

  const bytes = dlResult.data;
  const sizeKb = Math.round(bytes.byteLength / 1024);

  // 4. Sniff page count (best-effort)
  let pageCount: number | null = null;
  try {
    const doc = await getDocument({ data: new Uint8Array(bytes) }).promise;
    pageCount = doc.numPages;
    await doc.destroy();
  } catch {
    // pdfjs failed → leave pageCount null; extract step will surface the issue
  }

  // 5. Insert cache row
  const row = await prisma.insuranceFactsheetCache.create({
    data: {
      insurerSlug: args.insurerSlug,
      monthLabel: args.monthLabel,
      monthYyyymm: args.monthYyyymm,
      pdfBytes: bytes,
      pdfUrl: args.pdfUrl,
      sizeKb,
      pageCount,
      source: args.source,
    },
  });

  return {
    cacheId: row.id,
    insurer: args.insurerDisplay,
    insurerSlug: row.insurerSlug,
    monthLabel: row.monthLabel,
    monthYyyymm: row.monthYyyymm,
    pdfUrl: row.pdfUrl,
    sizeKb: row.sizeKb,
    pageCount: row.pageCount,
    source: row.source as "catalog" | "fallback",
    fromCache: false,
  };
}
