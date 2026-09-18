// tests/store-builder/sections.test.ts
import { describe, it, expect } from "vitest";
import {
  RESEARCH_SECTIONS,
  CATALOG_SECTIONS,
  BRANDING_SECTIONS,
  SOCIAL_SECTIONS,
  SHOPIFY_SECTIONS,
  pickActiveContent,
  renderApprovedContext,
} from "@/lib/store-builder/sections";
import type { EditableSection } from "@/lib/store-builder/types";

describe("section id constants", () => {
  it("research has six sections", () => {
    expect(RESEARCH_SECTIONS).toEqual([
      "marketAnalysis",
      "competitiveLandscape",
      "trends",
      "targetAudienceProfile",
      "pricingStrategy",
      "productRecommendations",
    ]);
  });

  it("branding includes brandVoice", () => {
    expect(BRANDING_SECTIONS).toContain("brandVoice");
  });
});

describe("pickActiveContent", () => {
  it("returns approvedVersion content when approvedVersionId is set", () => {
    const sec: EditableSection<string> = {
      id: "marketAnalysis",
      versions: [
        { id: "v1", content: "AI draft",  author: "ai",   createdAt: "2026-01-01T00:00:00Z" },
        { id: "v2", content: "user edit", author: "user", createdAt: "2026-01-01T00:01:00Z" },
      ],
      activeVersionId: "v2",
      approvedVersionId: "v1",
    };
    expect(pickActiveContent(sec)).toBe("AI draft");
  });

  it("falls back to activeVersion content when no approvedVersionId", () => {
    const sec: EditableSection<string> = {
      id: "marketAnalysis",
      versions: [{ id: "v1", content: "draft", author: "ai", createdAt: "2026-01-01T00:00:00Z" }],
      activeVersionId: "v1",
    };
    expect(pickActiveContent(sec)).toBe("draft");
  });

  it("throws when activeVersionId points to missing version", () => {
    const sec: EditableSection<string> = {
      id: "x",
      versions: [{ id: "v1", content: "a", author: "ai", createdAt: "" }],
      activeVersionId: "v-missing",
    };
    expect(() => pickActiveContent(sec)).toThrow(/activeVersionId/);
  });
});

describe("renderApprovedContext", () => {
  it("returns empty when nothing approved", () => {
    expect(renderApprovedContext({})).toBe("");
  });

  it("renders approved sections as a prompt block", () => {
    const out = renderApprovedContext({
      research: {
        competitiveLandscape: [{ name: "Brand X", url: "", priceRange: "", positioning: "", strengths: [] }],
      },
    });
    expect(out).toContain("Previously-approved content");
    expect(out).toContain("research.competitiveLandscape");
    expect(out).toContain("Brand X");
  });
});
