// lib/docx/helix-theme.ts
import {
  Paragraph, TextRun, PageBreak, AlignmentType, BorderStyle, Header, Footer,
  PageNumber,
} from "docx";

export const HELIX_PALETTE = {
  BLUE: "0085CF",
  DARK_BLUE: "003754",
  DARK: "1F2937",
  GRAY: "6B7280",
  LIGHT_GRAY: "F1F5F9",
  WHITE: "FFFFFF",
  ACCENT: "10B981",
} as const;

export const FONTS = {
  HEADING: "Calibri",
  BODY: "Calibri",
  MONO: "Consolas",
};

export interface CoverPageParams {
  title: string;
  subtitle?: string;
  author: string;
}

/** Returns a list of Paragraphs for the cover page. A page break is appended. */
export function buildCoverPage({ title, subtitle, author }: CoverPageParams): Paragraph[] {
  const iso = new Date().toISOString().slice(0, 10);
  const paras: Paragraph[] = [];

  paras.push(new Paragraph({
    spacing: { before: 2400 },  // ~1.6 inches of top space for cover feel
    children: [new TextRun({
      text: title,
      bold: true,
      color: HELIX_PALETTE.DARK_BLUE,
      size: 72,  // 36pt (docx uses half-points)
      font: FONTS.HEADING,
    })],
  }));

  if (subtitle) {
    paras.push(new Paragraph({
      spacing: { before: 200, after: 400 },
      children: [new TextRun({
        text: subtitle,
        color: HELIX_PALETTE.BLUE,
        size: 40,  // 20pt
        font: FONTS.HEADING,
      })],
    }));
  }

  // Divider rule via border-top on an empty paragraph.
  paras.push(new Paragraph({
    spacing: { before: 600, after: 600 },
    border: { top: { style: BorderStyle.SINGLE, size: 12, color: HELIX_PALETTE.BLUE } },
    children: [new TextRun({ text: "" })],
  }));

  paras.push(new Paragraph({
    children: [new TextRun({
      text: `${author} \u00b7 ${iso}`,
      color: HELIX_PALETTE.GRAY,
      size: 28,  // 14pt
      font: FONTS.BODY,
    })],
  }));

  paras.push(new Paragraph({ children: [new PageBreak()] }));
  return paras;
}

export function buildFooter(author: string): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: HELIX_PALETTE.BLUE } },
        children: [
          new TextRun({
            text: `${author}    `,
            color: HELIX_PALETTE.GRAY,
            size: 18,  // 9pt
            font: FONTS.BODY,
          }),
          new TextRun({
            children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES],
            color: HELIX_PALETTE.GRAY,
            size: 18,
            font: FONTS.BODY,
          }),
        ],
      }),
    ],
  });
}

export function buildHeaderRule(): Header {
  return new Header({
    children: [
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: HELIX_PALETTE.BLUE } },
        children: [new TextRun({ text: "" })],
      }),
    ],
  });
}
