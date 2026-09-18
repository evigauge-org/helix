import { describe, it, expect } from "vitest";
import { sanitizeDashboard } from "@/lib/agents/dashboards/sanitize";

describe("sanitizeDashboard", () => {
  it("strips iframes", () => {
    const out = sanitizeDashboard('<div>ok</div><iframe src="https://attacker.com"></iframe>');
    expect(out).toContain("<div>ok</div>");
    expect(out).not.toContain("iframe");
  });

  it("strips script with non-allowlisted src", () => {
    const out = sanitizeDashboard('<script src="https://evil.com/x.js"></script><p>hi</p>');
    expect(out).not.toContain("evil.com");
    expect(out).toContain("<p>hi</p>");
  });

  it("keeps script with allowlisted src (jsdelivr)", () => {
    const out = sanitizeDashboard('<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0"></script>');
    expect(out).toContain("cdn.jsdelivr.net/npm/chart.js");
  });

  it("strips on* event handlers", () => {
    const out = sanitizeDashboard('<button onclick="alert(1)">click</button>');
    expect(out).not.toMatch(/onclick/i);
  });

  it("keeps inline <script> blocks", () => {
    const out = sanitizeDashboard('<script>const x = 1;</script>');
    expect(out).toContain("const x = 1;");
  });

  it("strips javascript: URLs", () => {
    const out = sanitizeDashboard('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toMatch(/javascript:/i);
  });

  it("allows data: URIs in <img>", () => {
    const out = sanitizeDashboard('<img src="data:image/png;base64,iVBOR" alt="x">');
    expect(out).toContain('data:image/png;base64');
  });

  it("strips form, input, object, embed", () => {
    const out = sanitizeDashboard('<form><input name="x"></form><object data="x"></object><embed src="y">');
    expect(out).not.toMatch(/<form/i);
    expect(out).not.toMatch(/<input/i);
    expect(out).not.toMatch(/<object/i);
    expect(out).not.toMatch(/<embed/i);
  });
});
