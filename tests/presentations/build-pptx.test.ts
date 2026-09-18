import { describe, it, expect } from "vitest";
import { buildPptxBuffer } from "@/lib/presentations/build-pptx";
import type { DeckStructure } from "@/lib/slide-types";

const sampleDeck: DeckStructure = {
  title: "Test Deck",
  subtitle: "A minimal test",
  promise: "You will test pptxgenjs",
  slides: [
    { layout: "title", title: "Test Deck", subtitle: "A minimal test" },
    { layout: "content", title: "Some content", bullets: ["one", "two", "three"] },
    { layout: "close", title: "The end", subtitle: "Goodbye" },
  ],
};

describe("buildPptxBuffer", () => {
  it("returns a non-empty Buffer", async () => {
    const buf = await buildPptxBuffer(sampleDeck);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.byteLength).toBeGreaterThan(1000);
  });

  it("emits a ZIP/OOXML container (first 4 bytes = 50 4B 03 04)", async () => {
    const buf = await buildPptxBuffer(sampleDeck);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
  });
});
