// lib/agents/tools/insurance/shared/pdf-extract.ts
// Loads a cached PDF and returns per-page text via pdfjs-dist (legacy build).

import { prisma } from "@/lib/prisma";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PageText } from "./types";

export async function extractPagesFromCache(cacheId: string): Promise<{
  pages: PageText[];
  insurerSlug: string;
  monthLabel: string;
  pdfUrl: string;
}> {
  const row = await prisma.insuranceFactsheetCache.findUnique({ where: { id: cacheId } });
  if (!row) throw new Error(`No cached factsheet for cacheId=${cacheId}`);
  const bytes = row.pdfBytes;

  let doc;
  try {
    doc = await getDocument({ data: new Uint8Array(bytes) }).promise;
  } catch (e) {
    throw new Error(`pdfjs failed to open PDF: ${e instanceof Error ? e.message : String(e)}`);
  }

  const pages: PageText[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push({ pageNumber: i, text });
  }
  await doc.destroy();

  if (pages.every((p) => p.text.length === 0)) {
    throw new Error("PDF has no text layer (likely scanned image). Cannot extract.");
  }

  return {
    pages,
    insurerSlug: row.insurerSlug,
    monthLabel: row.monthLabel,
    pdfUrl: row.pdfUrl,
  };
}

// Slice the contiguous text between the first sectionStart marker and the next
// sectionEnd marker. Returns the empty string if neither marker matches —
// caller treats that as "use the whole PDF text".
export function slicePagesBetweenMarkers(
  pages: PageText[],
  startMarkers: string[],
  endMarkers: string[],
): string {
  const fullText = pages.map((p) => p.text).join("\n\n");

  let startIdx = -1;
  for (const marker of startMarkers) {
    const idx = fullText.toLowerCase().indexOf(marker.toLowerCase());
    if (idx >= 0 && (startIdx < 0 || idx < startIdx)) startIdx = idx;
  }
  if (startIdx < 0) return "";

  let endIdx = fullText.length;
  for (const marker of endMarkers) {
    const idx = fullText.toLowerCase().indexOf(marker.toLowerCase(), startIdx + 1);
    if (idx >= 0 && idx < endIdx) endIdx = idx;
  }

  return fullText.slice(startIdx, endIdx).trim();
}
