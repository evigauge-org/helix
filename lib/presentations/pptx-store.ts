// lib/presentations/pptx-store.ts
//
// In-memory bridge between PPTX producers (agent tools, export route) and
// consumers that need a public URL (Canva's import API fetches the file
// server-to-server). GET /api/presentations/store?id=<uuid> is intentionally
// unauthenticated — Canva has no way to present user credentials. Safety
// rests on (a) UUIDv4 unguessability (~122 bits), (b) a short 10-minute TTL,
// (c) Cache-Control: no-store on the GET response so proxies don't retain
// content past that window.
//
// Despite the "pptx" name, entries can carry any binary type (PDF, DOCX, JPG,
// PNG, etc.); the mimeType + filenameExt fields on each entry drive the GET
// response headers so Canva's import worker sees the correct format.

export type PptxStoreEntry = {
  buffer: Buffer;
  title: string;
  expiresAt: number;
  mimeType: string;
  filenameExt: string;
};

type WithStore = typeof globalThis & {
  __pptxStore?: Map<string, PptxStoreEntry>;
  __pptxStoreCleanupRegistered?: boolean;
};
const g = globalThis as WithStore;
if (!g.__pptxStore) g.__pptxStore = new Map();
export const pptxStore: Map<string, PptxStoreEntry> = g.__pptxStore;

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const DEFAULT_EXT = "pptx";

if (!g.__pptxStoreCleanupRegistered) {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of pptxStore) {
      if (val.expiresAt < now) pptxStore.delete(key);
    }
  }, 5 * 60 * 1000);
  g.__pptxStoreCleanupRegistered = true;
}

export function storePptx(
  buffer: Buffer,
  title: string,
  opts: { ttlMs?: number; mimeType?: string; filenameExt?: string } = {},
): { id: string; downloadUrl: string } {
  const id = crypto.randomUUID();
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
  const mimeType = opts.mimeType ?? DEFAULT_MIME;
  const filenameExt = opts.filenameExt ?? DEFAULT_EXT;
  pptxStore.set(id, {
    buffer,
    title,
    expiresAt: Date.now() + ttlMs,
    mimeType,
    filenameExt,
  });
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return { id, downloadUrl: `${baseUrl}/api/presentations/store?id=${id}` };
}
