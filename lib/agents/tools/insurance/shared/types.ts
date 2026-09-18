// lib/agents/tools/insurance/shared/types.ts
import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Discovery (landing-page scrape → PDF URL)
// ─────────────────────────────────────────────────────────────

export type DiscoveredFactsheet = {
  pdfUrl: string;
  monthLabel: string;
  source: "catalog" | "fallback";
};

export type SectionLocator = {
  sectionStartMarkers: string[];
  sectionEndMarkers: string[];
  columnAliases: Record<string, string>;
};

export type InsurerCatalogEntry = {
  slug: string;
  displayName: string;
  domain: string;
  landingUrl: string;
  discover: (html: string, monthOpt: string | "latest") => Promise<DiscoveredFactsheet | null>;
  locator: SectionLocator;
};

// ─────────────────────────────────────────────────────────────
// Fetch / extract output shapes
// ─────────────────────────────────────────────────────────────

export type FactsheetMeta = {
  cacheId: string;
  insurer: string;
  insurerSlug: string;
  monthLabel: string;
  monthYyyymm: string;
  pdfUrl: string;
  sizeKb: number;
  pageCount: number | null;
  source: "catalog" | "fallback";
  fromCache: boolean;
};

export type PageText = {
  pageNumber: number;
  text: string;
};

// ─────────────────────────────────────────────────────────────
// Canonical fund row (output of LLM normalizer)
// ─────────────────────────────────────────────────────────────

export const fundRowSchema = z.object({
  fundName: z.string(),
  fundType: z.string().nullable(),
  nav: z.number().nullable(),
  navDate: z.string().nullable(),
  aumCr: z.number().nullable(),
  oneMonthReturn: z.number().nullable(),
  threeMonthReturn: z.number().nullable(),
  sixMonthReturn: z.number().nullable(),
  oneYearReturn: z.number().nullable(),
  threeYearReturn: z.number().nullable(),
  fiveYearReturn: z.number().nullable(),
  sinceInceptionReturn: z.number().nullable(),
  inceptionDate: z.string().nullable(),
  expenseRatioPct: z.number().nullable(),
  benchmarkName: z.string().nullable(),
});

export type FundRow = z.infer<typeof fundRowSchema>;

export const extractedFactsheetSchema = z.object({
  insurer: z.string(),
  insurerSlug: z.string(),
  monthLabel: z.string(),
  sourceCacheId: z.string(),
  sourcePdfUrl: z.string().url(),
  funds: z.array(fundRowSchema),
  _confidence: z.enum(["high", "medium", "low"]),
  _warnings: z.array(z.string()),
});

export type ExtractedFactsheet = z.infer<typeof extractedFactsheetSchema>;
