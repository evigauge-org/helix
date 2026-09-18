import { describe, it, expect } from "vitest";
import { wrapBody } from "@/lib/agents/dashboards/wrapper";

describe("wrapBody", () => {
  it("returns valid HTML containing the body, Inter font link, Chart.js script, and wrapper CSS", () => {
    const html = wrapBody("<h1>Hello</h1>", "My Title");
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<h1>Hello</h1>");
    expect(html).toContain("fonts.googleapis.com/css2?family=Inter");
    expect(html).toContain("cdn.jsdelivr.net/npm/chart.js@4.4.0");
    expect(html).toContain(".helix-dashboard");
    expect(html).toContain(".kpi-card");
    expect(html).toContain(".data-table");
    expect(html).toContain(".chart-container");
    expect(html).toContain(".badge");
  });

  it("escapes HTML characters in the title", () => {
    const html = wrapBody("<p>x</p>", '<script>alert("xss")</script>');
    expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(html).not.toContain('<title><script>');
  });

  it("uses a fallback title when none provided", () => {
    const html = wrapBody("<p>x</p>");
    expect(html).toContain("<title>Dashboard</title>");
  });
});
