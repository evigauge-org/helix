// lib/agents/tools/insurance/shared/fallback.ts
// Generic factsheet discovery via Exa web_search. Used when the catalog has no
// entry for the requested insurer, OR when a curated discover() returned null.
//
// Also exports `genericLocator` — a permissive section locator used for
// fallback insurers' extract step.

import { browserHeaders } from "@/lib/agents/tools/ib/shared/headers";
import { withRetry } from "@/lib/agents/tools/ib/shared/resilience";
import type { DiscoveredFactsheet, SectionLocator } from "./types";

const EXA_BASE = "https://api.exa.ai/search";

export async function genericFallbackDiscover(
  insurerName: string,
  monthOpt: string | "latest",
  domainHint?: string,
): Promise<DiscoveredFactsheet | null> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) return null; // no Exa configured — give up cleanly

  const monthQuery =
    monthOpt === "latest"
      ? "latest factsheet"
      : `${monthOpt} factsheet`;
  const baseQuery = `${insurerName} ${monthQuery} pdf`;

  // Step 1: ask Exa
  const exaResult = await withRetry(
    async () => {
      const res = await fetch(EXA_BASE, {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: baseQuery,
          numResults: 5,
          includeDomains: domainHint ? [domainHint] : undefined,
          type: "neural",
        }),
      });
      if (!res.ok) throw new Error(`exa ${res.status}`);
      return (await res.json()) as { results?: Array<{ url?: string; title?: string }> };
    },
    { label: `exa search "${baseQuery}"` },
  );
  if (!exaResult.ok) return null;

  const hits = exaResult.data.results ?? [];
  const pdfHit = hits.find((h) => h.url?.toLowerCase().endsWith(".pdf"));
  if (!pdfHit?.url) return null;

  // Step 2: HEAD-verify content type
  try {
    const head = await fetch(pdfHit.url, { method: "HEAD", headers: browserHeaders() });
    const ct = head.headers.get("content-type") ?? "";
    if (!head.ok || (!ct.includes("pdf") && !pdfHit.url.toLowerCase().endsWith(".pdf"))) {
      return null;
    }
  } catch {
    return null;
  }

  return {
    pdfUrl: pdfHit.url,
    monthLabel: monthOpt === "latest" ? extractMonthFromUrl(pdfHit.url) : monthOpt,
    source: "fallback",
  };
}

// Best-effort: extract a month label from a filename like
// "investment-insight-aug-2025.pdf" → "August 2025".
function extractMonthFromUrl(url: string): string {
  const file = url.split("/").pop() ?? url;
  const months: Record<string, string> = {
    jan: "January", feb: "February", mar: "March", apr: "April",
    may: "May", jun: "June", jul: "July", aug: "August",
    sep: "September", oct: "October", nov: "November", dec: "December",
  };
  const m = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z\-_]*[\-_ ]?(\d{4})/i.exec(file);
  if (m) return `${months[m[1].toLowerCase()] ?? m[1]} ${m[2]}`;
  // Numeric fallback: 202508, 2025-08, 2025_08
  const n = /(\d{4})[\-_]?(\d{2})/.exec(file);
  if (n) {
    const idx = Number(n[2]) - 1;
    const monthNames = Object.values(months);
    if (idx >= 0 && idx < 12) return `${monthNames[idx]} ${n[1]}`;
  }
  return "Unknown";
}

export const genericLocator: SectionLocator = {
  sectionStartMarkers: [
    "Fund Performance",
    "NAV as on",
    "Fund Returns",
    "Performance Summary",
  ],
  sectionEndMarkers: [
    "Disclaimer",
    "Asset Allocation",
    "Fund Manager Commentary",
    "Risk Factors",
  ],
  columnAliases: {
    "1 Year": "oneYearReturn",
    "1Y": "oneYearReturn",
    "1-yr": "oneYearReturn",
    "1 Yr": "oneYearReturn",
    "3 Year": "threeYearReturn",
    "3Y": "threeYearReturn",
    "3-yr": "threeYearReturn",
    "3 Yr": "threeYearReturn",
    "5 Year": "fiveYearReturn",
    "5Y": "fiveYearReturn",
    "5-yr": "fiveYearReturn",
    "5 Yr": "fiveYearReturn",
    "Since Inception": "sinceInceptionReturn",
    "SI": "sinceInceptionReturn",
    "Inception": "sinceInceptionReturn",
    "1 Month": "oneMonthReturn",
    "1M": "oneMonthReturn",
    "3 Month": "threeMonthReturn",
    "3M": "threeMonthReturn",
    "6 Month": "sixMonthReturn",
    "6M": "sixMonthReturn",
    "NAV": "nav",
    "Net Asset Value": "nav",
    "AUM": "aumCr",
    "Assets Under Management": "aumCr",
    "Expense Ratio": "expenseRatioPct",
    "TER": "expenseRatioPct",
    "Benchmark": "benchmarkName",
  },
};
