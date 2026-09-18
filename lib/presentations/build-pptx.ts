import PptxGenJS from "pptxgenjs";
import type { DeckStructure } from "@/lib/slide-types";

export function buildPptx(deck: DeckStructure): PptxGenJS {
  const pptx = new PptxGenJS();
  pptx.author = "Helix";
  pptx.subject = deck.title;
  pptx.title = deck.title;
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inches

  const BLUE = "0085CF";
  const DARK_BLUE = "003754";
  const DARK = "1F2937";
  const GRAY = "6B7280";
  const LIGHT_GRAY = "F1F5F9";
  const WHITE = "FFFFFF";
  const ACCENT = "10B981";
  const W = 13.33;

  for (const slide of deck.slides) {
    const s = pptx.addSlide();

    if (slide.layout === "title") {
      s.background = { color: DARK_BLUE };
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.06, fill: { color: BLUE } });
      s.addText(slide.title, {
        x: 1.2, y: 2.0, w: W - 2.4, h: 1.6,
        fontSize: 44, fontFace: "Calibri", color: WHITE, bold: true, align: "left",
        lineSpacingMultiple: 1.2,
      });
      if (slide.subtitle) {
        s.addText(slide.subtitle, {
          x: 1.2, y: 3.9, w: W - 2.4, h: 0.8,
          fontSize: 22, fontFace: "Calibri", color: "80C3EA", align: "left",
        });
      }
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 6.8, w: W, h: 0.7, fill: { color: BLUE } });
      s.addText("Helix Intelligence", {
        x: 1.2, y: 6.85, w: W - 2.4, h: 0.5,
        fontSize: 13, fontFace: "Calibri", color: WHITE, align: "left",
      });
    } else if (slide.layout === "promise") {
      s.background = { color: WHITE };
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: 7.5, fill: { color: ACCENT } });
      s.addText("EMPOWERMENT PROMISE", {
        x: 0.8, y: 0.5, w: W - 1.6, h: 0.4,
        fontSize: 12, fontFace: "Calibri", color: ACCENT, bold: true, charSpacing: 2,
      });
      s.addText(slide.title, {
        x: 0.8, y: 0.95, w: W - 1.6, h: 1,
        fontSize: 36, fontFace: "Calibri", color: DARK_BLUE, bold: true,
      });
      if (slide.bullets) {
        const bulletText = slide.bullets.map((b) => ({
          text: b,
          options: {
            fontSize: 20, fontFace: "Calibri", color: DARK,
            bullet: { type: "bullet" as const, color: ACCENT },
            lineSpacingMultiple: 1.8,
            paraSpaceAfter: 12,
          },
        }));
        s.addText(bulletText, { x: 1.2, y: 2.4, w: W - 2.4, h: 4.5, valign: "top" });
      }
    } else if (slide.layout === "inspiration") {
      s.background = { color: BLUE };
      s.addText(slide.title, {
        x: 1.2, y: 0.8, w: W - 2.4, h: 1,
        fontSize: 32, fontFace: "Calibri", color: WHITE, bold: true,
      });
      if (slide.bullets) {
        const bulletText = slide.bullets.map((b) => ({
          text: b,
          options: {
            fontSize: 18, fontFace: "Calibri", color: WHITE,
            bullet: { type: "bullet" as const, color: "80C3EA" },
            lineSpacingMultiple: 1.6,
            paraSpaceAfter: 10,
          },
        }));
        s.addText(bulletText, { x: 1.2, y: 2.3, w: W - 2.4, h: 4.5, valign: "top" });
      }
    } else if (slide.layout === "heuristic") {
      s.background = { color: WHITE };
      // Left accent bar (thick for heuristic)
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.15, h: 7.5, fill: { color: BLUE } });
      // Label
      s.addText("HEURISTIC", {
        x: 0.8, y: 0.5, w: W - 1.6, h: 0.4,
        fontSize: 12, fontFace: "Calibri", color: BLUE, bold: true, charSpacing: 2,
      });
      // Number/title
      s.addText(slide.title, {
        x: 0.8, y: 0.95, w: W - 1.6, h: 0.7,
        fontSize: 22, fontFace: "Calibri", color: GRAY,
      });
      // The rule itself — huge
      if (slide.heuristic) {
        s.addText(slide.heuristic, {
          x: 0.8, y: 2.0, w: W - 1.6, h: 3.0,
          fontSize: 42, fontFace: "Calibri", color: DARK_BLUE, bold: true,
          lineSpacingMultiple: 1.15,
        });
      }
      // Evidence
      if (slide.evidence) {
        s.addShape(pptx.ShapeType.rect, {
          x: 0.8, y: 5.3, w: W - 1.6, h: 1.5, fill: { color: LIGHT_GRAY }, rectRadius: 0.15,
        });
        s.addText("EVIDENCE", {
          x: 1.0, y: 5.45, w: W - 2.0, h: 0.3,
          fontSize: 10, fontFace: "Calibri", color: BLUE, bold: true, charSpacing: 2,
        });
        s.addText(slide.evidence, {
          x: 1.0, y: 5.75, w: W - 2.0, h: 1.0,
          fontSize: 14, fontFace: "Calibri", color: DARK, italic: true,
          lineSpacingMultiple: 1.4,
        });
      }
      if (slide.notes) s.addNotes(slide.notes);
    } else if (slide.layout === "content" || slide.layout === "evidence") {
      s.background = { color: WHITE };
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: 7.5, fill: { color: BLUE } });
      s.addText(slide.title, {
        x: 0.8, y: 0.4, w: W - 1.6, h: 0.8,
        fontSize: 26, fontFace: "Calibri", color: DARK_BLUE, bold: true,
      });
      s.addShape(pptx.ShapeType.rect, { x: 0.8, y: 1.25, w: 1.5, h: 0.04, fill: { color: BLUE } });
      if (slide.bullets) {
        const bulletText = slide.bullets.map((b) => ({
          text: b,
          options: {
            fontSize: 17, fontFace: "Calibri", color: DARK,
            bullet: { type: "bullet" as const, color: BLUE },
            lineSpacingMultiple: 1.6,
            paraSpaceAfter: 10,
          },
        }));
        s.addText(bulletText, { x: 0.8, y: 1.6, w: W - 1.6, h: 5.2, valign: "top" });
      }
      if (slide.notes) s.addNotes(slide.notes);
    } else if (slide.layout === "two_column") {
      s.background = { color: WHITE };
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: 7.5, fill: { color: BLUE } });
      s.addText(slide.title, {
        x: 0.8, y: 0.4, w: W - 1.6, h: 0.8,
        fontSize: 26, fontFace: "Calibri", color: DARK_BLUE, bold: true,
      });
      s.addShape(pptx.ShapeType.rect, { x: 0.8, y: 1.25, w: 1.5, h: 0.04, fill: { color: BLUE } });
      const colW = (W - 2.2) / 2;
      if (slide.leftColumn) {
        s.addShape(pptx.ShapeType.rect, {
          x: 0.8, y: 1.5, w: colW, h: 5.2, fill: { color: LIGHT_GRAY }, rectRadius: 0.15,
        });
        s.addText(slide.leftColumn.heading, {
          x: 1.1, y: 1.7, w: colW - 0.6, h: 0.5,
          fontSize: 18, fontFace: "Calibri", color: BLUE, bold: true,
        });
        const leftBullets = slide.leftColumn.bullets.map((b) => ({
          text: b,
          options: {
            fontSize: 14, fontFace: "Calibri", color: DARK,
            bullet: { type: "bullet" as const, color: BLUE },
            lineSpacingMultiple: 1.5, paraSpaceAfter: 6,
          },
        }));
        s.addText(leftBullets, { x: 1.1, y: 2.3, w: colW - 0.6, h: 4.0, valign: "top" });
      }
      if (slide.rightColumn) {
        const rx = 0.8 + colW + 0.6;
        s.addShape(pptx.ShapeType.rect, {
          x: rx, y: 1.5, w: colW, h: 5.2, fill: { color: LIGHT_GRAY }, rectRadius: 0.15,
        });
        s.addText(slide.rightColumn.heading, {
          x: rx + 0.3, y: 1.7, w: colW - 0.6, h: 0.5,
          fontSize: 18, fontFace: "Calibri", color: BLUE, bold: true,
        });
        const rightBullets = slide.rightColumn.bullets.map((b) => ({
          text: b,
          options: {
            fontSize: 14, fontFace: "Calibri", color: DARK,
            bullet: { type: "bullet" as const, color: BLUE },
            lineSpacingMultiple: 1.5, paraSpaceAfter: 6,
          },
        }));
        s.addText(rightBullets, { x: rx + 0.3, y: 2.3, w: colW - 0.6, h: 4.0, valign: "top" });
      }
    } else if (slide.layout === "key_stat") {
      s.background = { color: WHITE };
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: 7.5, fill: { color: BLUE } });
      s.addText(slide.title, {
        x: 0.8, y: 0.4, w: W - 1.6, h: 0.8,
        fontSize: 26, fontFace: "Calibri", color: DARK_BLUE, bold: true,
      });
      s.addShape(pptx.ShapeType.rect, {
        x: (W - 8) / 2, y: 2.0, w: 8, h: 3.5, fill: { color: LIGHT_GRAY }, rectRadius: 0.2,
      });
      if (slide.stat) {
        s.addText(slide.stat, {
          x: (W - 8) / 2, y: 2.2, w: 8, h: 2.0,
          fontSize: 72, fontFace: "Calibri", color: BLUE, bold: true, align: "center",
        });
      }
      if (slide.statLabel) {
        s.addText(slide.statLabel, {
          x: (W - 8) / 2, y: 4.2, w: 8, h: 0.8,
          fontSize: 20, fontFace: "Calibri", color: GRAY, align: "center",
        });
      }
    } else if (slide.layout === "quote") {
      s.background = { color: WHITE };
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: 7.5, fill: { color: ACCENT } });
      s.addText(slide.title, {
        x: 0.8, y: 0.4, w: W - 1.6, h: 0.8,
        fontSize: 26, fontFace: "Calibri", color: DARK_BLUE, bold: true,
      });
      s.addText("\u201C", {
        x: 1.5, y: 1.5, w: 1.2, h: 1.5,
        fontSize: 96, fontFace: "Georgia", color: BLUE, bold: true,
      });
      if (slide.quote) {
        s.addText(slide.quote, {
          x: 2.3, y: 2.3, w: W - 4.5, h: 2.8,
          fontSize: 24, fontFace: "Georgia", color: DARK, italic: true,
          lineSpacingMultiple: 1.5,
        });
      }
      if (slide.quoteAuthor) {
        s.addText(`\u2014 ${slide.quoteAuthor}`, {
          x: 2.3, y: 5.3, w: W - 4.5, h: 0.5,
          fontSize: 16, fontFace: "Calibri", color: GRAY,
        });
      }
    } else if (slide.layout === "cycle") {
      s.background = { color: WHITE };
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: 7.5, fill: { color: BLUE } });
      s.addText("THE CYCLE", {
        x: 0.8, y: 0.5, w: W - 1.6, h: 0.4,
        fontSize: 12, fontFace: "Calibri", color: BLUE, bold: true, charSpacing: 2,
      });
      s.addText(slide.title, {
        x: 0.8, y: 0.95, w: W - 1.6, h: 1,
        fontSize: 34, fontFace: "Calibri", color: DARK_BLUE, bold: true,
      });
      if (slide.bullets) {
        slide.bullets.forEach((b, idx) => {
          const y = 2.5 + idx * 1.2;
          s.addShape(pptx.ShapeType.ellipse, {
            x: 1.2, y, w: 0.8, h: 0.8, fill: { color: BLUE },
          });
          s.addText(String(idx + 1), {
            x: 1.2, y: y + 0.15, w: 0.8, h: 0.5,
            fontSize: 22, fontFace: "Calibri", color: WHITE, bold: true, align: "center",
          });
          s.addText(b, {
            x: 2.3, y: y + 0.1, w: W - 3.5, h: 0.8,
            fontSize: 18, fontFace: "Calibri", color: DARK,
            valign: "middle",
          });
        });
      }
    } else if (slide.layout === "contribution") {
      s.background = { color: DARK_BLUE };
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.06, fill: { color: ACCENT } });
      s.addText("OUR CONTRIBUTION", {
        x: 1.2, y: 1.0, w: W - 2.4, h: 0.5,
        fontSize: 14, fontFace: "Calibri", color: ACCENT, bold: true, charSpacing: 3,
      });
      s.addText(slide.title, {
        x: 1.2, y: 1.6, w: W - 2.4, h: 1.2,
        fontSize: 38, fontFace: "Calibri", color: WHITE, bold: true,
      });
      if (slide.contribution) {
        s.addText(slide.contribution, {
          x: 1.2, y: 3.2, w: W - 2.4, h: 3,
          fontSize: 24, fontFace: "Calibri", color: "B3DBF2",
          lineSpacingMultiple: 1.5,
        });
      }
    } else if (slide.layout === "close") {
      s.background = { color: DARK_BLUE };
      s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.06, fill: { color: BLUE } });
      s.addText(slide.title, {
        x: 1.2, y: 2.5, w: W - 2.4, h: 1.2,
        fontSize: 44, fontFace: "Calibri", color: WHITE, bold: true, align: "center",
      });
      if (slide.subtitle) {
        s.addText(slide.subtitle, {
          x: 1.2, y: 3.9, w: W - 2.4, h: 0.8,
          fontSize: 22, fontFace: "Calibri", color: "80C3EA", align: "center", italic: true,
        });
      }
    }
  }

  return pptx;
}

export async function buildPptxBuffer(deck: DeckStructure): Promise<Buffer> {
  const pptx = buildPptx(deck);
  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as unknown as Buffer;
  return buffer;
}
