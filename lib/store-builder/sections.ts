// lib/store-builder/sections.ts
import type { EditableSection } from "./types";

export const RESEARCH_SECTIONS = [
  "marketAnalysis",
  "competitiveLandscape",
  "trends",
  "targetAudienceProfile",
  "pricingStrategy",
  "productRecommendations",
] as const;

export const CATALOG_SECTIONS = ["products"] as const;

export const BRANDING_SECTIONS = [
  "nameOptions",
  "colors",
  "typography",
  "brandVoice",
] as const;

export const SOCIAL_SECTIONS = ["captionTemplates", "hashtagSet"] as const;

export const SHOPIFY_SECTIONS = ["launchChecklist", "themeNotes"] as const;

export type ResearchSectionId = typeof RESEARCH_SECTIONS[number];
export type CatalogSectionId = typeof CATALOG_SECTIONS[number];
export type BrandingSectionId = typeof BRANDING_SECTIONS[number];
export type SocialSectionId = typeof SOCIAL_SECTIONS[number];
export type ShopifySectionId = typeof SHOPIFY_SECTIONS[number];

export function pickActiveContent<T>(section: EditableSection<T>): T {
  const chosenId = section.approvedVersionId ?? section.activeVersionId;
  const version = section.versions.find((v) => v.id === chosenId);
  if (!version) {
    throw new Error(
      `pickActiveContent: section "${section.id}" has activeVersionId="${section.activeVersionId}" ` +
      `but no matching version in versions[] (length ${section.versions.length})`,
    );
  }
  return version.content;
}

export interface ApprovedContextBag {
  research?: Partial<Record<ResearchSectionId, unknown>>;
  catalog?: Partial<Record<CatalogSectionId, unknown>>;
  branding?: Partial<Record<BrandingSectionId, unknown>>;
  social?: Partial<Record<SocialSectionId, unknown>>;
  shopify?: Partial<Record<ShopifySectionId, unknown>>;
}

export function renderApprovedContext(bag: ApprovedContextBag): string {
  const entries: string[] = [];
  for (const [stage, sections] of Object.entries(bag)) {
    if (!sections) continue;
    for (const [sectionId, content] of Object.entries(sections)) {
      if (content === undefined || content === null) continue;
      entries.push(
        `[${stage}.${sectionId}, approved by user]\n${
          typeof content === "string" ? content : JSON.stringify(content, null, 2)
        }`,
      );
    }
  }
  if (entries.length === 0) return "";
  return `\n\nPreviously-approved content (treat as ground truth; do not contradict):\n\n${entries.join("\n\n")}`;
}
