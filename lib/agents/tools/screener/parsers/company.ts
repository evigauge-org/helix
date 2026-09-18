// lib/agents/tools/screener/parsers/company.ts
import type { CheerioAPI } from "cheerio";

export type Company = {
  name: string;
  bse: string | null;
  nse: string | null;
  industry: string | null;
  website: string | null;
  about: string | null;
};

/**
 * Reads name (h1), BSE/NSE codes (header buttons "BSE: 500325", "NSE: RELIANCE"),
 * industry (link to /commodity/sector page), website (link to external site),
 * and About paragraphs (#about section).
 */
export function parseCompany($: CheerioAPI): Company {
  const name = $("h1").first().text().trim();

  let bse: string | null = null;
  let nse: string | null = null;
  $(".company-info, .company-links, .sub").each((_, el) => {
    const text = $(el).text();
    const bseM = text.match(/BSE:\s*(\d+)/i);
    if (bseM && !bse) bse = bseM[1];
    const nseM = text.match(/NSE:\s*([A-Z0-9.&-]+)/i);
    if (nseM && !nse) nse = nseM[1];
  });

  let industry: string | null = null;
  $("a[href^='/commodity/'], a[href*='/sector/']").each((_, a) => {
    if (industry) return;
    const t = $(a).text().trim();
    if (t) industry = t;
  });

  let website: string | null = null;
  $("a[href^='http']").each((_, a) => {
    if (website) return;
    const href = $(a).attr("href") ?? "";
    const text = $(a).text().trim().toLowerCase();
    if (
      (text.includes("website") || text.includes("home page")) &&
      !href.includes("screener.in")
    ) {
      website = href;
    }
  });

  let about: string | null = null;
  const aboutText = $("#about, .about, section.company-profile")
    .first()
    .find("p")
    .map((_, p) => $(p).text().trim())
    .get()
    .filter((t) => t.length > 0)
    .join("\n\n");
  if (aboutText) about = aboutText.slice(0, 2000);

  return { name, bse, nse, industry, website, about };
}
