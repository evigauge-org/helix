// lib/agents/tools/insurance/shared/slug-resolver.ts
// Fuzzy-resolve user input ("Bajaj", "BAJAJ ALLIANZ LIFE", "balic") to a
// canonical InsurerCatalogEntry. Returns null when no entry matches; caller
// falls back to web_search.

import type { InsurerCatalogEntry } from "./types";

const KEBAB_RE = /[^a-z0-9]+/g;

function kebab(s: string): string {
  return s.toLowerCase().replace(KEBAB_RE, "-").replace(/^-|-$/g, "");
}

export function resolveInsurerSlug(
  input: string,
  catalog: InsurerCatalogEntry[],
): InsurerCatalogEntry | null {
  if (!input) return null;
  const raw = input.trim();
  const lower = raw.toLowerCase();
  const k = kebab(raw);

  // 1. Exact slug match
  for (const e of catalog) {
    if (e.slug === lower || e.slug === k) return e;
  }

  // 2. Display name exact (case-insensitive)
  for (const e of catalog) {
    if (e.displayName.toLowerCase() === lower) return e;
  }

  // 3. Substring containment in either direction
  for (const e of catalog) {
    const dn = e.displayName.toLowerCase();
    if (dn.includes(lower) || lower.includes(dn)) return e;
    const ds = kebab(e.displayName);
    if (k.length >= 3 && (ds.includes(k) || k.includes(ds))) return e;
  }

  // 4. Common short forms
  const shortForms: Record<string, string> = {
    "balic": "bajaj-allianz-life",
    "tata": "tata-aia-life",
    "pnb": "pnb-metlife",
    "hdfc": "hdfc-life",
    "icici": "icici-prudential-life",
    "icici pru": "icici-prudential-life",
    "sbi": "sbi-life",
    "lic": "lic",
    "max": "max-life",
  };
  if (lower in shortForms) {
    return catalog.find((e) => e.slug === shortForms[lower]) ?? null;
  }

  return null;
}
