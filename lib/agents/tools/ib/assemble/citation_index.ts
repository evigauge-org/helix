// lib/agents/tools/ib/assemble/citation_index.ts
// Walks all sub-agent outputs and produces a flat, de-duplicated citation
// index with stable IDs (src1, src2, ...). Sub-agent outputs reference
// these IDs in their `sources: string[]` arrays after compression.

export type FlatCitation = { id: string; url: string; quote: string };

export function buildCitationIndex(allSourceLists: string[][]): FlatCitation[] {
  const seen = new Map<string, FlatCitation>();
  let idx = 1;
  for (const list of allSourceLists) {
    for (const url of list) {
      if (seen.has(url)) continue;
      seen.set(url, { id: `src${idx}`, url, quote: "" });
      idx++;
    }
  }
  return Array.from(seen.values());
}
