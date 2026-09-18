// lib/agents/tools/insurance/india_insurance_factsheet_extract.ts
// Reads a cached PDF (by cacheId from india_insurance_factsheet_fetch),
// slices out the fund-performance section using the insurer's locator,
// and asks an LLM to normalize it to a FundRow[]. Returns ExtractedFactsheet.

import { z } from "zod";
import type { ToolDef } from "@/lib/agents/types";
import { extractPagesFromCache, slicePagesBetweenMarkers } from "./shared/pdf-extract";
import { CATALOG } from "./shared/catalog";
import { genericLocator } from "./shared/fallback";
import { normalizeFundRows } from "./shared/row-normalizer";
import type { ExtractedFactsheet } from "./shared/types";

const schema = z.object({
  cacheId: z.string().min(1),
});

function computeConfidence(rows: ExtractedFactsheet["funds"]): "high" | "medium" | "low" {
  if (rows.length === 0) return "low";
  const checkedFields: Array<keyof ExtractedFactsheet["funds"][number]> = [
    "nav",
    "oneYearReturn",
    "threeYearReturn",
    "fiveYearReturn",
    "sinceInceptionReturn",
  ];
  let nullCount = 0;
  let totalCount = 0;
  for (const row of rows) {
    for (const f of checkedFields) {
      totalCount++;
      if (row[f] === null || row[f] === undefined) nullCount++;
    }
  }
  if (totalCount === 0) return "low";
  const nullRate = nullCount / totalCount;
  if (nullRate < 0.1) return "high";
  if (nullRate < 0.3) return "medium";
  return "low";
}

export const indiaInsuranceFactsheetExtractTool: ToolDef<typeof schema> = {
  slug: "india_insurance_factsheet_extract",
  description:
    "Extract structured fund rows (NAV, returns, AUM, etc.) from a cached " +
    "Indian life-insurer factsheet PDF. Takes a cacheId from " +
    "india_insurance_factsheet_fetch, slices the fund-performance section " +
    "using the insurer's locator (or a generic fallback), and runs an LLM " +
    "JSON normalizer over it. Returns ExtractedFactsheet with funds[] and a " +
    "confidence flag derived from null-density on key return fields.",
  schema,
  execute: async (_ctx, args) => {
    try {
      // 1. Pull pages + provenance from cache
      const { pages, insurerSlug, monthLabel, pdfUrl } = await extractPagesFromCache(args.cacheId);

      // 2. Resolve locator + display name from catalog (or generic fallback)
      const catalogEntry = CATALOG.find((e) => e.slug === insurerSlug) ?? null;
      const locator = catalogEntry?.locator ?? genericLocator;
      const insurerDisplay = catalogEntry?.displayName ?? insurerSlug;

      // 3. Slice the fund-performance section. If markers don't match, fall
      //    back to the full PDF text so the LLM still gets a shot.
      let sectionText = slicePagesBetweenMarkers(
        pages,
        locator.sectionStartMarkers,
        locator.sectionEndMarkers,
      );
      const sectionWarnings: string[] = [];
      if (!sectionText) {
        sectionWarnings.push(
          "section markers did not match; passing full PDF text to normalizer",
        );
        sectionText = pages.map((p) => p.text).join("\n\n");
      }

      // 4. LLM normalize
      const { rows, warnings } = await normalizeFundRows({
        sectionText,
        insurerDisplay,
        monthLabel,
        locator,
      });

      // 5. Confidence + assemble
      const confidence = computeConfidence(rows);
      const result: ExtractedFactsheet = {
        insurer: insurerDisplay,
        insurerSlug,
        monthLabel,
        sourceCacheId: args.cacheId,
        sourcePdfUrl: pdfUrl,
        funds: rows,
        _confidence: confidence,
        _warnings: [...sectionWarnings, ...warnings],
      };
      return { ok: true, data: result };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
