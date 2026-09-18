// lib/agents/tools/recruitment/types.ts
import { z } from "zod";

/* ──────────── Apify input schema (mirrors the actor OpenAPI) ──────────── */

export const yearsOfExperienceIdSchema = z.enum(["1", "2", "3", "4", "5"]);
export type YearsOfExperienceId = z.infer<typeof yearsOfExperienceIdSchema>;

export const seniorityLevelIdSchema = z.enum([
  "100", "110", "120", "130", "200", "210", "220", "300", "310", "320",
]);
export type SeniorityLevelId = z.infer<typeof seniorityLevelIdSchema>;

export const functionIdSchema = z.enum([
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13",
  "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26",
]);
export type FunctionId = z.infer<typeof functionIdSchema>;

export const profileScraperModeSchema = z.enum(["Short", "Full", "Full + email search"]);
export type ProfileScraperMode = z.infer<typeof profileScraperModeSchema>;

export const apifyInputSchema = z.object({
  searchQuery: z.string().max(300).optional(),
  locations: z.array(z.string()).max(70).optional(),
  excludeLocations: z.array(z.string()).max(70).optional(),
  currentCompanies: z.array(z.string()).max(50).optional(),
  pastCompanies: z.array(z.string()).max(50).optional(),
  schools: z.array(z.string()).max(50).optional(),
  currentJobTitles: z.array(z.string()).max(50).optional(),
  pastJobTitles: z.array(z.string()).max(50).optional(),
  yearsOfExperienceIds: z.array(yearsOfExperienceIdSchema).optional(),
  yearsAtCurrentCompanyIds: z.array(yearsOfExperienceIdSchema).optional(),
  seniorityLevelIds: z.array(seniorityLevelIdSchema).optional(),
  functionIds: z.array(functionIdSchema).optional(),
  industryIds: z.array(z.string()).max(50).optional(),
  firstNames: z.array(z.string()).max(50).optional(),
  lastNames: z.array(z.string()).max(50).optional(),
  profileLanguages: z.array(z.string()).optional(),
  companyHeadcount: z.array(z.string()).optional(),
  companyHeadquarterLocations: z.array(z.string()).max(70).optional(),
  recentlyChangedJobs: z.boolean().optional(),
  profileScraperMode: profileScraperModeSchema.default("Full + email search"),
  maxItems: z.number().int().positive().max(500).default(20),
  autoQuerySegmentation: z.boolean().default(true),
  autoQuerySegmentationLevels: z.array(z.string()).default(["default"]),
  autoQuerySegmentationTargetCountries: z.array(z.string()).optional(),
  startPage: z.number().int().min(1).max(100).default(1),
  takePages: z.number().int().min(0).max(100).optional(),
});
export type ApifyInput = z.infer<typeof apifyInputSchema>;

/* ──────────── Normalized candidate profile (our internal shape) ──────────── */

export interface ProfileEducation {
  school: string;
  degree?: string;
  fieldOfStudy?: string;
  startYear?: number;
  endYear?: number;
}

export interface ProfilePosition {
  title: string;
  company: string;
  companyUrl?: string;
  location?: string;
  startDate?: string; // ISO-ish ("2019-01") or year ("2019") depending on source
  endDate?: string;   // same; omit or "present"/null for current role
}

export interface ApifyProfile {
  id: string;
  name: string;
  headline: string;
  linkedinUrl: string;
  location?: string;
  currentPosition?: ProfilePosition;  // undefined when unemployed / between jobs
  pastPositions: ProfilePosition[];
  education: ProfileEducation[];
  email?: string;
  raw: Record<string, unknown>; // preserve the full actor payload
}

/* ──────────── Validation brief (built by the brief API, consumed by tools) ──────────── */

export interface ValidationBrief {
  minPqe?: number;
  mustStillBeInDomain?: boolean;
  domainTitleKeywords?: string[];
  domainIndustryKeywords?: string[];
  domainCompanyHints?: string[];
}

/* ──────────── Cross-reference output ──────────── */

export type EvidenceSourceType = "user_provided" | "past_company" | "general_web";

export interface EvidenceUrl {
  url: string;
  confidence: number;          // 0-1
  employer: string;
  matchedFields: string[];     // e.g. ["name","title","tenure"]
  sourceType: EvidenceSourceType;
  extractedSnippet?: string;
}

export type CrossReferenceFailureReason =
  | "pqe_below_threshold"
  | "pivoted_away"
  | "never_in_domain"
  | "no_evidence";

export interface CrossReferenceResult {
  candidate_id: string;
  validated: boolean;
  pqe_years: number | null;
  currently_in_domain: boolean;
  previously_in_domain: boolean;
  topTierMatch: boolean;
  evidence_urls: EvidenceUrl[];
  verified_employers: string[];
  reasoning: string;
  failure_reason?: CrossReferenceFailureReason;
}

/* ──────────── Firm directory scrape output ──────────── */

export interface DirectoryPerson {
  name: string;
  title?: string;
  profileUrl?: string;
  practiceAreas?: string[];
}

export interface FirmDirectoryResult {
  firm: string;
  url: string;
  people: DirectoryPerson[];
}
