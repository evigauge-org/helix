import { encode, decode } from "gpt-tokenizer";

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

export interface Chunk {
  index: number;
  content: string;
  tokenCount: number;
}

export function chunkText(text: string): Chunk[] {
  const cleaned = text.trim();
  if (!cleaned) return [];
  const tokens = encode(cleaned);
  if (tokens.length <= CHUNK_SIZE) {
    return [{ index: 0, content: cleaned, tokenCount: tokens.length }];
  }
  const out: Chunk[] = [];
  let start = 0;
  let idx = 0;
  while (start < tokens.length) {
    const end = Math.min(start + CHUNK_SIZE, tokens.length);
    const slice = tokens.slice(start, end);
    out.push({
      index: idx,
      content: decode(slice).trim(),
      tokenCount: slice.length,
    });
    if (end >= tokens.length) break;
    start = end - CHUNK_OVERLAP;
    idx += 1;
  }
  return out;
}
