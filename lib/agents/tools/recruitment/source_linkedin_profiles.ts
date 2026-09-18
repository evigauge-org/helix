// lib/agents/tools/recruitment/source_linkedin_profiles.ts
import { registerTool } from "../../tool-registry";
import type { ToolDef } from "../../types";
import {
  apifyInputSchema,
  type ApifyInput,
  type ApifyProfile,
  type ProfilePosition,
  type ProfileEducation,
} from "./types";

const APIFY_RUN_URL =
  "https://api.apify.com/v2/acts/harvestapi~linkedin-profile-search/run-sync-get-dataset-items";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickString(v: any, ...keys: string[]): string | undefined {
  for (const k of keys) {
    if (typeof v?.[k] === "string" && v[k].length > 0) return v[k];
  }
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizePosition(p: any): ProfilePosition | undefined {
  if (!p || typeof p !== "object") return undefined;
  const title = pickString(p, "title", "positionTitle");
  const company = pickString(p, "company", "companyName", "organization");
  if (!title || !company) return undefined;
  return {
    title,
    company,
    companyUrl: pickString(p, "companyUrl", "companyLinkedinUrl"),
    location: pickString(p, "location"),
    startDate: pickString(p, "startDate", "start"),
    endDate: pickString(p, "endDate", "end"),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeEducation(e: any): ProfileEducation | undefined {
  if (!e || typeof e !== "object") return undefined;
  const school = pickString(e, "school", "schoolName", "institution");
  if (!school) return undefined;
  return {
    school,
    degree: pickString(e, "degree", "degreeName"),
    fieldOfStudy: pickString(e, "fieldOfStudy", "field"),
    startYear: typeof e.startYear === "number" ? e.startYear : undefined,
    endYear: typeof e.endYear === "number" ? e.endYear : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeProfile(raw: any): ApifyProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const name = pickString(raw, "name", "fullName");
  const linkedinUrl = pickString(raw, "url", "profileUrl", "linkedinUrl");
  if (!name || !linkedinUrl) return null;

  const experienceList = Array.isArray(raw.experience) ? raw.experience
    : Array.isArray(raw.positions) ? raw.positions
    : [];
  const normalizedPositions = experienceList
    .map((p: unknown) => normalizePosition(p))
    .filter((p: ProfilePosition | undefined): p is ProfilePosition => !!p);

  // Heuristic: the first position with no endDate is current.
  const currentPosition = normalizedPositions.find(
    (p: ProfilePosition) => !p.endDate || /present/i.test(p.endDate),
  );
  const pastPositions = normalizedPositions.filter((p: ProfilePosition) => p !== currentPosition);

  const educationList = Array.isArray(raw.education) ? raw.education : [];
  const education = educationList
    .map((e: unknown) => normalizeEducation(e))
    .filter((e: ProfileEducation | undefined): e is ProfileEducation => !!e);

  return {
    id: pickString(raw, "id", "profileId") ?? linkedinUrl,
    name,
    headline: pickString(raw, "headline", "summary") ?? "",
    linkedinUrl,
    location: pickString(raw, "location", "locationName"),
    currentPosition,
    pastPositions,
    education,
    email: pickString(raw, "email", "emailAddress"),
    raw,
  };
}

const tool: ToolDef<typeof apifyInputSchema> = {
  slug: "source_linkedin_profiles",
  description:
    "Source LinkedIn profiles via Apify's harvestapi~linkedin-profile-search actor. " +
    "Filters mirror the actor's OpenAPI schema (locations, seniorityLevelIds, functionIds, " +
    "yearsOfExperienceIds, currentCompanies, pastCompanies, schools, etc.). " +
    "functionIds: 14=Legal, 8=Engineering, 11=Healthcare Services, 10=Finance, etc. " +
    "seniorityLevelIds: 110=Entry, 120=Senior, 220=Director, 310=CXO. " +
    "Returns { profiles: ApifyProfile[] } — each profile has currentPosition (may be absent " +
    "if candidate is between jobs), pastPositions, education, linkedinUrl, optional email. " +
    "Tool clamps maxItems to APIFY_MAX_ITEMS_CAP env (default 50). ALWAYS follow with " +
    "cross_reference_candidate before including a profile in final output.",
  schema: apifyInputSchema,
  async execute(_ctx, input: ApifyInput) {
    const token = process.env.APIFY_TOKEN;
    if (!token) {
      return { ok: false, error: "APIFY_TOKEN not configured in env" };
    }
    const cap = Number(process.env.APIFY_MAX_ITEMS_CAP ?? "50");
    const body = { ...input, maxItems: Math.min(input.maxItems ?? 20, cap) };

    const url = `${APIFY_RUN_URL}?token=${encodeURIComponent(token)}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      return { ok: false, error: `Apify fetch failed: ${err instanceof Error ? err.message : String(err)}` };
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `Apify ${res.status}: ${text.slice(0, 500)}` };
    }

    let rawItems: unknown;
    try {
      rawItems = await res.json();
    } catch (err) {
      return { ok: false, error: `Apify response not JSON: ${err instanceof Error ? err.message : String(err)}` };
    }
    if (!Array.isArray(rawItems)) {
      return { ok: false, error: "Apify response was not an array of profiles" };
    }

    const profiles = rawItems
      .map((r) => normalizeProfile(r))
      .filter((p): p is ApifyProfile => p !== null);

    return {
      ok: true,
      data: { profiles, rawCount: rawItems.length, normalizedCount: profiles.length },
    };
  },
};

registerTool(tool);
export default tool;
