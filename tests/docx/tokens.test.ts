import { describe, it, expect } from "vitest";
import MarkdownIt from "markdown-it";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// @ts-expect-error — no @types/markdown-it-task-lists published
import mitt from "markdown-it-task-lists";
import { renderTokens } from "@/lib/docx/tokens";
import { Paragraph, Table } from "docx";

const md = new MarkdownIt({ html: true }).use(mitt as unknown as (md: MarkdownIt) => void);

describe("renderTokens — core token types", () => {
  it("renders a heading", () => {
    const out = renderTokens(md.parse("# Hello", {}));
    expect(out.some((e) => e instanceof Paragraph)).toBe(true);
  });

  it("renders a paragraph with bold and italic", () => {
    const out = renderTokens(md.parse("Hello **bold** and *italic* world.", {}));
    expect(out.some((e) => e instanceof Paragraph)).toBe(true);
  });

  it("renders a bullet list with three items", () => {
    const out = renderTokens(md.parse("- a\n- b\n- c", {}));
    // Expect 3 list-item Paragraphs
    const paras = out.filter((e) => e instanceof Paragraph) as Paragraph[];
    expect(paras.length).toBeGreaterThanOrEqual(3);
  });

  it("renders a table", () => {
    const table = "| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |";
    const out = renderTokens(md.parse(table, {}));
    expect(out.some((e) => e instanceof Table)).toBe(true);
  });

  it("renders a code block", () => {
    const out = renderTokens(md.parse("```\nhello\n```", {}));
    expect(out.some((e) => e instanceof Paragraph)).toBe(true);
  });

  it("renders a blockquote", () => {
    const out = renderTokens(md.parse("> quoted", {}));
    expect(out.some((e) => e instanceof Paragraph)).toBe(true);
  });

  it("renders a hyperlink", () => {
    const out = renderTokens(md.parse("Click [here](https://example.com)", {}));
    expect(out.some((e) => e instanceof Paragraph)).toBe(true);
  });

  it("produces at least one element for html_block via passthrough", () => {
    const out = renderTokens(md.parse("<custom-thing>raw html</custom-thing>", {}));
    expect(out.length).toBeGreaterThan(0);
  });
});
