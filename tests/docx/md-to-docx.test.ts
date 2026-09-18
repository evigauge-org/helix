import { describe, it, expect } from "vitest";
import { renderMarkdownToDocx } from "@/lib/docx/md-to-docx";
import { Packer } from "docx";
import { readZipXml } from "./test-helpers";

describe("renderMarkdownToDocx", () => {
  it("returns a Document that packs to a non-empty buffer", async () => {
    const { document } = renderMarkdownToDocx({
      title: "Test", markdown: "# Hello\n\nWorld", coverPage: false,
    });
    const buf = await Packer.toBuffer(document);
    expect(buf.byteLength).toBeGreaterThan(500);
  });

  it("emits OOXML (zip/docx magic bytes)", async () => {
    const { document } = renderMarkdownToDocx({
      title: "Test", markdown: "body", coverPage: false,
    });
    const buf = await Packer.toBuffer(document);
    // ZIP magic = PK\x03\x04 (0x50 0x4B 0x03 0x04)
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
  });

  it("reports tokenCount > 0", () => {
    const { tokenCount } = renderMarkdownToDocx({
      title: "Test", markdown: "# H\n\np1\n\n- a\n- b", coverPage: false,
    });
    expect(tokenCount).toBeGreaterThan(5);
  });

  it("reports unmappedTokens as empty for standard markdown", () => {
    const { unmappedTokens } = renderMarkdownToDocx({
      title: "Test", markdown: "# H\n\n- a\n- b", coverPage: false,
    });
    expect(unmappedTokens).toEqual([]);
  });

  it("includes cover page content when coverPage=true", async () => {
    const { document } = renderMarkdownToDocx({
      title: "TitleXYZ", subtitle: "SubtitleZZZ", author: "AuthorQQQ", markdown: "body", coverPage: true,
    });
    const buf = await Packer.toBuffer(document);
    const xml = await readZipXml(Buffer.from(buf), "word/document.xml");
    expect(xml).toContain("TitleXYZ");
    expect(xml).toContain("SubtitleZZZ");
    expect(xml).toContain("AuthorQQQ");
  });
});
