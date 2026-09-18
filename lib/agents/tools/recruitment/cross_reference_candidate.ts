// lib/agents/tools/recruitment/cross_reference_candidate.ts
import { z } from "zod";
import { registerTool } from "../../tool-registry";
import type { ToolDef } from "../../types";
import type {
  ApifyProfile,
  CrossReferenceFailureReason,
  CrossReferenceResult,
  EvidenceUrl,
  ProfileEducation,
  ProfilePosition,
} from "./types";
import { firecrawlSearch, firecrawlScrape } from "@/lib/firecrawl";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/* ──────────── Domain keyword matching ──────────── */

function lowercaseAny(haystack: string, needles: string[] | undefined): boolean {
  if (!needles || needles.length === 0) return false;
  const h = haystack.toLowerCase();
  return needles.some((n) => h.includes(n.toLowerCase()));
}

function positionIsInDomain(
  position: ProfilePosition | undefined,
  titleKw: string[] | undefined,
  industryKw: string[] | undefined,
  companyHints: string[] | undefined,
): boolean {
  if (!position) return false;
  const titleHit = lowercaseAny(position.title, titleKw);
  const companyHit =
    lowercaseAny(position.company, industryKw) || lowercaseAny(position.company, companyHints);
  return titleHit && (companyHit || !industryKw?.length);
}

/* ──────────── PQE computation ──────────── */

// Regex for "qualifying" degrees per common domains. Extend as needed.
const QUALIFYING_DEGREE_PATTERNS: RegExp[] = [
  /\b(ll\.?b|ll\.?m|juris doctor|j\.?d|b\.?a\.?\s*ll\.?b|bachelor of laws)\b/i, // legal
  /\b(mbbs|m\.?d\.?(?!\s*in)|do\b|dnb)\b/i,                                      // medical
  /\b(m\.?b\.?a|mba)\b/i,                                                        // business
  /\b(b\.?tech|b\.?e\.?|m\.?tech|m\.?s\b|bachelor of engineering|master of science)\b/i, // engineering
];

function educationHasQualifyingDegree(ed: ProfileEducation): boolean {
  const text = `${ed.degree ?? ""} ${ed.fieldOfStudy ?? ""}`.trim();
  if (!text) return false;
  return QUALIFYING_DEGREE_PATTERNS.some((re) => re.test(text));
}

function endYearOf(ed: ProfileEducation): number | null {
  return typeof ed.endYear === "number" ? ed.endYear : null;
}

function startYearOf(pos: ProfilePosition): number | null {
  const s = pos.startDate;
  if (!s) return null;
  const m = /(\d{4})/.exec(s);
  return m ? Number(m[1]) : null;
}

export function computePqe(
  education: ProfileEducation[],
  positions: ProfilePosition[],
  domainTitleKeywords: string[] | undefined,
): number | null {
  // 1. Qualifying-degree end year (pick the LATEST if multiple).
  const qualifyingEndYears = education
    .filter(educationHasQualifyingDegree)
    .map(endYearOf)
    .filter((y): y is number => y !== null);
  if (qualifyingEndYears.length === 0) return null;
  const qualifiedYear = Math.max(...qualifyingEndYears);

  // 2. First post-qualification role whose title matches the domain.
  const candidatePositions = positions
    .filter((p) => {
      const y = startYearOf(p);
      return y !== null && y >= qualifiedYear;
    })
    .sort((a, b) => (startYearOf(a) ?? 0) - (startYearOf(b) ?? 0));

  const firstRelevant = candidatePositions.find((p) =>
    lowercaseAny(p.title, domainTitleKeywords),
  ) ?? candidatePositions[0];
  if (!firstRelevant) return null;
  const startYear = startYearOf(firstRelevant);
  if (startYear === null) return null;

  const currentYear = new Date().getUTCFullYear();
  return Math.max(0, currentYear - startYear);
}

/* ──────────── LLM judge for ambiguous company-domain match ──────────── */

async function llmCompanyInDomain(
  company: string,
  industryKw: string[],
): Promise<boolean> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return false;
  const prompt = `Is the company "${company}" operating in any of these domains: ${industryKw.join(", ")}?
Answer ONLY with "yes" or "no".`;
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemma-3-27b-it",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4,
      temperature: 0,
    }),
  });
  if (!res.ok) return false;
  const raw = ((await res.json())?.choices?.[0]?.message?.content ?? "") as string;
  return /\byes\b/i.test(raw.trim());
}

/* ──────────── Multi-source evidence sweep ──────────── */

interface SweepHit {
  employer: string;
  evidence: EvidenceUrl;
}

async function searchOnDomain(
  domain: string,
  candidate: ApifyProfile,
  employer: string,
  sourceType: EvidenceUrl["sourceType"],
): Promise<SweepHit[]> {
  const q = `site:${domain} "${candidate.name}"`;
  const hits = await firecrawlSearch(q, { limit: 3 });
  const evidenceHits: SweepHit[] = [];
  for (const hit of hits) {
    const page = await firecrawlScrape(hit.url, { onlyMainContent: true, formats: ["markdown"] });
    if (!page?.markdown) continue;
    const lower = page.markdown.toLowerCase();
    const matchedFields: string[] = [];
    if (lower.includes(candidate.name.toLowerCase())) matchedFields.push("name");
    if (candidate.currentPosition && lower.includes(candidate.currentPosition.title.toLowerCase())) matchedFields.push("title");
    if (lower.includes(employer.toLowerCase())) matchedFields.push("employer");
    for (const ed of candidate.education) {
      if (lower.includes(ed.school.toLowerCase())) { matchedFields.push("education"); break; }
    }
    if (matchedFields.length < 2) continue; // too weak to record
    const confidence = Math.min(1, matchedFields.length * 0.25 + 0.1);
    evidenceHits.push({
      employer,
      evidence: {
        url: hit.url,
        confidence,
        employer,
        matchedFields: Array.from(new Set(matchedFields)),
        sourceType,
        extractedSnippet: page.markdown.slice(0, 300),
      },
    });
  }
  return evidenceHits;
}

/* ──────────── Input schema + main execute ──────────── */

const validationBriefSchema = z.object({
  minPqe: z.number().min(0).max(60).optional(),
  mustStillBeInDomain: z.boolean().default(true),
  domainTitleKeywords: z.array(z.string()).optional(),
  domainIndustryKeywords: z.array(z.string()).optional(),
  domainCompanyHints: z.array(z.string()).optional(),
});

const profileSchema: z.ZodType<ApifyProfile> = z.any(); // trust upstream normalization

const schema = z.object({
  candidate: profileSchema,
  validation: validationBriefSchema,
  sourceUrls: z.array(z.string().url()).max(30).default([]),
});

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

const tool: ToolDef<typeof schema> = {
  slug: "cross_reference_candidate",
  description:
    "Validate a single sourced candidate against the recruitment brief. Checks: (1) " +
    "post-qualification experience (PQE) computed from the candidate's education + work " +
    "history against validation.minPqe. (2) Domain-continuity: candidate is 'still in the " +
    "domain' if currentPosition matches the domain keywords/industry, OR they are between " +
    "jobs but most-recent past role was in-domain. Pivoted-away candidates are rejected. " +
    "(3) Multi-source evidence sweep: for EVERY URL in sourceUrls and for the candidate's " +
    "top-3 past companies, runs targeted web search + scrape to find corroborating profile " +
    "pages. A directory-match against a reputable firm flags topTierMatch. Returns a full " +
    "CrossReferenceResult the agent must use before including the candidate in output.",
  schema,
  async execute(_ctx, { candidate, validation, sourceUrls }) {
    const titleKw = validation.domainTitleKeywords;
    const industryKw = validation.domainIndustryKeywords;
    const companyHints = validation.domainCompanyHints;

    /* --- PQE gate --- */
    const allPositions = [
      ...(candidate.currentPosition ? [candidate.currentPosition] : []),
      ...candidate.pastPositions,
    ];
    const pqe = computePqe(candidate.education, allPositions, titleKw);
    const pqeOk = validation.minPqe === undefined || (pqe !== null && pqe >= validation.minPqe);

    /* --- Domain-continuity gate --- */
    let currently_in_domain = false;
    let previously_in_domain = false;
    let domainFailure: CrossReferenceFailureReason | null = null;

    const currentInDomainKwOnly = positionIsInDomain(
      candidate.currentPosition, titleKw, industryKw, companyHints,
    );

    if (candidate.currentPosition) {
      if (currentInDomainKwOnly) {
        currently_in_domain = true;
      } else if (industryKw?.length && titleKw && lowercaseAny(candidate.currentPosition.title, titleKw)) {
        // Title hints at domain but company industry ambiguous → ask LLM once.
        const inDomain = await llmCompanyInDomain(candidate.currentPosition.company, industryKw);
        currently_in_domain = inDomain;
      }
      if (!currently_in_domain) domainFailure = "pivoted_away";
    } else {
      // No current position — look at most-recent past role.
      const mostRecent = [...candidate.pastPositions].sort(
        (a, b) => (startYearOf(b) ?? 0) - (startYearOf(a) ?? 0),
      )[0];
      const pastOk = positionIsInDomain(mostRecent, titleKw, industryKw, companyHints);
      previously_in_domain = pastOk;
      if (!pastOk) domainFailure = "never_in_domain";
    }

    const domainOk = !validation.mustStillBeInDomain || currently_in_domain || previously_in_domain;

    /* --- Evidence sweep --- */
    const evidence_urls: EvidenceUrl[] = [];
    const verified_employers_set = new Set<string>();
    let topTierMatch = false;

    // Current employer name for search seed
    const anchorEmployer =
      candidate.currentPosition?.company ?? candidate.pastPositions[0]?.company ?? "";

    // 1) user-provided source URLs
    for (const src of sourceUrls) {
      const domain = hostOf(src);
      const hits = await searchOnDomain(domain, candidate, anchorEmployer, "user_provided");
      for (const h of hits) {
        evidence_urls.push(h.evidence);
        verified_employers_set.add(h.employer);
        if (h.evidence.confidence >= 0.5) topTierMatch = true;
      }
    }

    // 2) top-3 past companies' own domains (best-effort)
    const top3Past = candidate.pastPositions.slice(0, 3);
    for (const past of top3Past) {
      if (!past.companyUrl) continue;
      const domain = hostOf(past.companyUrl);
      const hits = await searchOnDomain(domain, candidate, past.company, "past_company");
      for (const h of hits) {
        evidence_urls.push(h.evidence);
        verified_employers_set.add(past.company);
      }
    }

    // 3) One general web search (no site filter) for press/bar listings
    const general = await firecrawlSearch(
      `"${candidate.name}" ${candidate.currentPosition?.title ?? ""} ${anchorEmployer}`.trim(),
      { limit: 3 },
    );
    for (const hit of general) {
      evidence_urls.push({
        url: hit.url,
        confidence: 0.3,
        employer: anchorEmployer,
        matchedFields: ["name"],
        sourceType: "general_web",
        extractedSnippet: hit.description?.slice(0, 300),
      });
    }

    /* --- Assemble result --- */
    let failure_reason: CrossReferenceFailureReason | undefined;
    if (!pqeOk) failure_reason = "pqe_below_threshold";
    else if (!domainOk && domainFailure) failure_reason = domainFailure;
    else if (evidence_urls.length === 0 && validation.mustStillBeInDomain) failure_reason = "no_evidence";

    const validated = !failure_reason;

    const reasoningParts: string[] = [];
    reasoningParts.push(`PQE: ${pqe ?? "unknown"}${validation.minPqe !== undefined ? ` (need ≥ ${validation.minPqe})` : ""}`);
    reasoningParts.push(
      currently_in_domain ? `currently in domain at ${candidate.currentPosition?.company}`
      : previously_in_domain ? `between jobs; most-recent role was in domain`
      : domainFailure === "pivoted_away" ? `currently out of domain — likely pivoted`
      : `no in-domain history`,
    );
    if (evidence_urls.length > 0) reasoningParts.push(`${evidence_urls.length} evidence URLs`);
    if (topTierMatch) reasoningParts.push("top-tier firm-directory match");

    const result: CrossReferenceResult = {
      candidate_id: candidate.id,
      validated,
      pqe_years: pqe,
      currently_in_domain,
      previously_in_domain,
      topTierMatch,
      evidence_urls,
      verified_employers: Array.from(verified_employers_set),
      reasoning: reasoningParts.join(" · "),
      failure_reason,
    };
    return { ok: true, data: result };
  },
};

registerTool(tool);
export default tool;
