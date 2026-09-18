import { describe, it, expect } from "vitest";
import { HELIX_PALETTE, buildCoverPage, buildFooter, buildHeaderRule } from "@/lib/docx/helix-theme";

describe("HELIX_PALETTE", () => {
  it("matches the buildPptx palette (BLUE=0085CF, DARK_BLUE=003754)", () => {
    expect(HELIX_PALETTE.BLUE).toBe("0085CF");
    expect(HELIX_PALETTE.DARK_BLUE).toBe("003754");
    expect(HELIX_PALETTE.DARK).toBe("1F2937");
    expect(HELIX_PALETTE.GRAY).toBe("6B7280");
    expect(HELIX_PALETTE.LIGHT_GRAY).toBe("F1F5F9");
    expect(HELIX_PALETTE.WHITE).toBe("FFFFFF");
    expect(HELIX_PALETTE.ACCENT).toBe("10B981");
  });
});

describe("buildCoverPage", () => {
  it("returns an array of docx elements", () => {
    const out = buildCoverPage({ title: "My Memo", subtitle: "A subtitle", author: "Helix" });
    expect(Array.isArray(out)).toBe(true);
    expect(out.length).toBeGreaterThan(0);
  });
});

describe("buildFooter + buildHeaderRule", () => {
  it("buildFooter returns an object (docx Footer)", () => {
    const f = buildFooter("Helix Intelligence");
    expect(f).toBeTruthy();
    expect(typeof f).toBe("object");
  });
  it("buildHeaderRule returns an object", () => {
    const h = buildHeaderRule();
    expect(h).toBeTruthy();
  });
});
