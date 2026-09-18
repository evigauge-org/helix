// lib/agents/tools/insurance/india_insurance_factsheet_fetch.ts
import { z } from "zod";
import type { ToolDef } from "@/lib/agents/types";
import { downloadAndCache } from "./shared/pdf-fetch";
import { resolveInsurerSlug } from "./shared/slug-resolver";
import { genericFallbackDiscover } from "./shared/fallback";
import { CATALOG } from "./shared/catalog";
import { browserHeaders } from "@/lib/agents/tools/ib/shared/headers";
import { withRetry } from "@/lib/agents/tools/ib/shared/resilience";

const schema = z.object({
  insurer: z.string().min(1).max(80),
  month: z.string().regex(/^(\d{4}-\d{2}|latest)$/).default("latest"),
});

function monthYyyymm(monthLabel: string, monthOpt: string): string {
  if (/^\d{4}-\d{2}$/.test(monthOpt)) return monthOpt;
  // "August 2025" → "2025-08"
  const months: Record<string, string> = {
    january: "01", february: "02", march: "03", april: "04",
    may: "05", june: "06", july: "07", august: "08",
    september: "09", october: "10", november: "11", december: "12",
  };
  const m = /^([A-Za-z]+)\s+(\d{4})$/.exec(monthLabel);
  if (m && months[m[1].toLowerCase()]) return `${m[2]}-${months[m[1].toLowerCase()]}`;
  // Fallback: today's year-month
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const indiaInsuranceFactsheetFetchTool: ToolDef<typeof schema> = {
  slug: "india_insurance_factsheet_fetch",
  description:
    "Fetch a monthly factsheet PDF from an Indian life insurer. " +
    "Curated insurers (bajaj-allianz-life, tata-aia-life, pnb-metlife, hdfc-life, icici-prudential-life, sbi-life, lic, max-life) use direct landing-page scrapers; " +
    "other insurers fall through to web_search. Returns cacheId + a download URL the chat can render. " +
    "Idempotent — second call for same (insurer, month) returns the cached row.",
  schema,
  execute: async (_ctx, args) => {
    const insurerEntry = resolveInsurerSlug(args.insurer, CATALOG);
    const insurerDisplay = insurerEntry?.displayName ?? args.insurer;
    const insurerSlug = insurerEntry?.slug ?? args.insurer.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    // 1. Try catalog discover()
    let discovered = null as null | { pdfUrl: string; monthLabel: string; source: "catalog" | "fallback" };
    if (insurerEntry) {
      try {
        const htmlResult = await withRetry(
          async () => {
            const res = await fetch(insurerEntry.landingUrl, { headers: browserHeaders({ accept: "text/html" }) });
            if (!res.ok) throw new Error(`landing ${res.status}`);
            return await res.text();
          },
          { label: `landing ${insurerEntry.slug}` },
        );
        if (htmlResult.ok) {
          const result = await insurerEntry.discover(htmlResult.data, args.month);
          if (result) discovered = { ...result, source: "catalog" };
        }
      } catch {
        // landing fetch failed → fall through to fallback
      }
    }

    // 2. Generic fallback if catalog failed (or no entry)
    if (!discovered) {
      const fb = await genericFallbackDiscover(insurerDisplay, args.month, insurerEntry?.domain);
      if (!fb) {
        return {
          ok: false,
          error: `No factsheet PDF found for ${insurerDisplay} ${args.month}. Try a different month or check the insurer's IR page directly.`,
        };
      }
      discovered = fb;
    }

    // 3. Download + cache
    try {
      const meta = await downloadAndCache({
        insurerSlug,
        insurerDisplay,
        monthLabel: discovered.monthLabel,
        monthYyyymm: monthYyyymm(discovered.monthLabel, args.month),
        pdfUrl: discovered.pdfUrl,
        source: discovered.source,
      });
      return {
        ok: true,
        data: {
          ...meta,
          downloadUrl: `/api/insurance/factsheet/${meta.cacheId}/pdf`,
        },
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
