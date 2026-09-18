// tests/docx/kitchen-sink.test.ts
import { describe, it, expect } from "vitest";
import { renderMarkdownToDocx } from "@/lib/docx/md-to-docx";
import { Packer } from "docx";
import { readZipXml } from "./test-helpers";
import fs from "node:fs";
import path from "node:path";

const fixture = fs.readFileSync(
  path.resolve(__dirname, "fixtures/kitchen-sink.md"),
  "utf-8",
);

// Hand-listed literal strings we expect to appear in word/document.xml.
// If any of these are missing, the no-lost-content guarantee is broken.
const MUST_APPEAR_IN_DOC = [
  "Heading Level One",
  "Heading Level Two",
  "Heading Level Three",
  "paragraph with",
  "bold text",
  "italic text",
  "strikethrough",
  "inline code",
  "hyperlink to example",
  "First bullet",
  "Second bullet with",
  "bold",
  "Third bullet with",
  "a link",
  "First ordered",
  "Second ordered",
  "Third ordered",
  // XML-escaped: docx serializer escapes U+0027 apostrophe to `&apos;`,
  // so the literal `CFO's` from the markdown lands as `CFO&apos;s` in word/document.xml.
  "A blockquote citing the CFO&apos;s Q4 guidance.",
  "code fence content line 1",
  "code fence content line 2",
  "Column A",
  "Column B",
  "Column C",
  "alpha",
  "beta",
  "gamma",
  "$4.2B",
  "12% CAGR",
  "https://src.com",
  "custom-html-passthrough",              // raw HTML preserved as text
  "This is raw HTML that must survive as text.",
  "alt text for image",                    // image alt survives via passthrough
  "example.com/image.png",                 // image URL survives
];

describe("kitchen-sink no-lost-content guarantee", () => {
  it("every input string is present in the resulting word/document.xml", async () => {
    const { document, unmappedTokens, tokenCount } = renderMarkdownToDocx({
      title: "Kitchen Sink", markdown: fixture, coverPage: false,
    });
    expect(tokenCount).toBeGreaterThan(30);

    const buf = await Packer.toBuffer(document);
    const xml = await readZipXml(Buffer.from(buf), "word/document.xml");

    const missing: string[] = [];
    for (const needle of MUST_APPEAR_IN_DOC) {
      if (!xml.includes(needle)) missing.push(needle);
    }
    if (missing.length > 0) {
      throw new Error(
        `${missing.length} strings missing from DOCX:\n` +
          missing.map((m) => `  - ${m}`).join("\n") +
          `\n\nUnmapped token types: ${unmappedTokens.join(", ") || "(none)"}`,
      );
    }
    expect(missing).toEqual([]);
  });
});
