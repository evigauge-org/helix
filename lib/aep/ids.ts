// lib/aep/ids.ts
import { ulid } from "ulid";

export type AepIdPrefix = "agt" | "run" | "msg" | "art" | "mem" | "sub" | "ses" | "evt" | "phe" | "pch";

export function newAepId(prefix: AepIdPrefix): string {
  return `${prefix}_${ulid()}`;
}

export function parseAepIdPrefix(id: string): AepIdPrefix | null {
  const idx = id.indexOf("_");
  if (idx <= 0) return null;
  const p = id.slice(0, idx);
  const valid: AepIdPrefix[] = ["agt","run","msg","art","mem","sub","ses","evt","phe","pch"];
  return (valid as string[]).includes(p) ? (p as AepIdPrefix) : null;
}

export function assertAepId(id: string, expected: AepIdPrefix): void {
  const p = parseAepIdPrefix(id);
  if (p !== expected) {
    throw new Error(`Expected AEP id with prefix '${expected}_', got: ${id}`);
  }
}
