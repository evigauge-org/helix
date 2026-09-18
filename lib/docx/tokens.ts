// lib/docx/tokens.ts
import type Token from "markdown-it/lib/token.mjs";
import {
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  ExternalHyperlink,
  ShadingType,
} from "docx";
import { HELIX_PALETTE, FONTS } from "./helix-theme";

type Elem = Paragraph | Table;

const HEADING_LEVELS: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  h1: HeadingLevel.HEADING_1,
  h2: HeadingLevel.HEADING_2,
  h3: HeadingLevel.HEADING_3,
  h4: HeadingLevel.HEADING_4,
  h5: HeadingLevel.HEADING_5,
  h6: HeadingLevel.HEADING_6,
};

// Tracks unmapped token types so the caller can surface them.
const unmappedTokensCollector = new Set<string>();

export function drainUnmappedTokens(): string[] {
  const arr = Array.from(unmappedTokensCollector);
  unmappedTokensCollector.clear();
  return arr;
}

interface StyleOverrides {
  bold?: boolean;
  italics?: boolean;
  color?: string;
  font?: string;
  size?: number;
  underline?: boolean;
}

/**
 * Flatten inline children into TextRun[] respecting bold/italic/strong/em/strike/code/link.
 * When `overrides` is provided, every produced TextRun merges the override on top of the
 * computed per-token style (used by headings and table cells to apply a uniform look).
 */
function renderInline(
  children: Token[] | null | undefined,
  overrides: StyleOverrides = {},
): TextRun[] {
  if (!children) return [];
  const runs: TextRun[] = [];
  const stack: { bold?: boolean; italic?: boolean; strike?: boolean; code?: boolean; linkUrl?: string }[] = [{}];

  const top = () => stack[stack.length - 1];

  for (const tok of children) {
    const ctx = top();
    switch (tok.type) {
      case "text": {
        const baseFont = ctx.code ? FONTS.MONO : FONTS.BODY;
        const baseColor = ctx.linkUrl ? HELIX_PALETTE.BLUE : HELIX_PALETTE.DARK;
        runs.push(new TextRun({
          text: tok.content,
          bold: overrides.bold ?? ctx.bold,
          italics: overrides.italics ?? ctx.italic,
          strike: ctx.strike,
          font: overrides.font ?? baseFont,
          shading: ctx.code
            ? { type: ShadingType.CLEAR, fill: HELIX_PALETTE.LIGHT_GRAY, color: "auto" }
            : undefined,
          color: overrides.color ?? baseColor,
          underline: overrides.underline || ctx.linkUrl ? {} : undefined,
          size: overrides.size ?? 22, // 11pt default
        }));
        break;
      }
      case "strong_open":
        stack.push({ ...ctx, bold: true });
        break;
      case "strong_close":
        stack.pop();
        break;
      case "em_open":
        stack.push({ ...ctx, italic: true });
        break;
      case "em_close":
        stack.pop();
        break;
      case "s_open":
        stack.push({ ...ctx, strike: true });
        break;
      case "s_close":
        stack.pop();
        break;
      case "code_inline":
        runs.push(new TextRun({
          text: tok.content,
          font: overrides.font ?? FONTS.MONO,
          size: overrides.size ?? 22,
          bold: overrides.bold,
          italics: overrides.italics,
          color: overrides.color,
          shading: { type: ShadingType.CLEAR, fill: HELIX_PALETTE.LIGHT_GRAY, color: "auto" },
        }));
        break;
      case "link_open": {
        const href = tok.attrs?.find((a) => a[0] === "href")?.[1] ?? "";
        stack.push({ ...ctx, linkUrl: href });
        break;
      }
      case "link_close":
        stack.pop();
        break;
      case "softbreak":
        runs.push(new TextRun({ text: " " }));
        break;
      case "hardbreak":
        runs.push(new TextRun({ text: "", break: 1 }));
        break;
      case "image": {
        const alt = tok.content;
        const src = tok.attrs?.find((a) => a[0] === "src")?.[1] ?? "";
        runs.push(new TextRun({
          text: `[image: ${alt} \u2014 ${src}]`,
          italics: true,
          color: HELIX_PALETTE.GRAY,
          size: 20,
          font: FONTS.BODY,
        }));
        break;
      }
      case "html_inline":
        runs.push(new TextRun({ text: tok.content, font: FONTS.MONO, size: 20 }));
        break;
      default:
        unmappedTokensCollector.add(`inline:${tok.type}`);
        if (tok.content) {
          runs.push(new TextRun({
            text: tok.content,
            size: overrides.size ?? 22,
            font: overrides.font,
            color: overrides.color,
          }));
        }
    }
  }

  return runs;
}

/**
 * Same as renderInline but groups `link_open ... link_close` into an ExternalHyperlink
 * so Word renders a real clickable link. Used for body paragraphs and list items.
 */
function hyperlinkedInline(children: Token[] | null | undefined): (TextRun | ExternalHyperlink)[] {
  if (!children) return [];
  const out: (TextRun | ExternalHyperlink)[] = [];
  let i = 0;
  while (i < children.length) {
    const tok = children[i];
    if (tok.type === "link_open") {
      const href = tok.attrs?.find((a) => a[0] === "href")?.[1] ?? "";
      const innerChildren: Token[] = [];
      i++;
      while (i < children.length && children[i].type !== "link_close") {
        innerChildren.push(children[i]);
        i++;
      }
      i++; // skip link_close
      // ExternalHyperlink in docx does NOT auto-restyle its children — we apply
      // Helix blue + underline via renderInline's style overrides so inner runs
      // (including bold/italic nested inside the link) keep their per-token
      // structure while still reading as a proper hyperlink in Word.
      const runs = renderInline(innerChildren, {
        color: HELIX_PALETTE.BLUE,
        underline: true,
      });
      out.push(new ExternalHyperlink({ link: href, children: runs }));
    } else {
      out.push(...renderInline([tok]));
      i++;
    }
  }
  return out;
}

export function renderTokens(tokens: Token[]): Elem[] {
  const out: Elem[] = [];

  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];

    // Heading
    if (tok.type === "heading_open") {
      const tag = tok.tag;
      const levelKey = tag as keyof typeof HEADING_LEVELS;
      const inlineTok = tokens[i + 1];
      const level = HEADING_LEVELS[levelKey] ?? HeadingLevel.HEADING_3;
      const color =
        tag === "h1" ? HELIX_PALETTE.DARK_BLUE :
        tag === "h2" ? HELIX_PALETTE.BLUE :
        HELIX_PALETTE.DARK_BLUE;
      const size =
        tag === "h1" ? 44 :
        tag === "h2" ? 36 :
        tag === "h3" ? 28 : 24;
      const children = renderInline(inlineTok?.children ?? [], {
        bold: true,
        color,
        font: FONTS.HEADING,
        size,
      });
      out.push(new Paragraph({
        heading: level,
        spacing: { before: 300, after: 150 },
        children,
      }));
      i += 3; // heading_open, inline, heading_close
      continue;
    }

    // Paragraph
    if (tok.type === "paragraph_open") {
      const inlineTok = tokens[i + 1];
      out.push(new Paragraph({
        spacing: { before: 80, after: 80, line: 336 }, // ~1.4 line-height in twips
        children: hyperlinkedInline(inlineTok?.children ?? []),
      }));
      i += 3;
      continue;
    }

    // Bullet list
    if (tok.type === "bullet_list_open") {
      const { endIdx, paras } = renderList(tokens, i, false);
      out.push(...paras);
      i = endIdx + 1;
      continue;
    }
    if (tok.type === "ordered_list_open") {
      const { endIdx, paras } = renderList(tokens, i, true);
      out.push(...paras);
      i = endIdx + 1;
      continue;
    }

    // Blockquote
    if (tok.type === "blockquote_open") {
      const { endIdx, paras } = renderBlockquote(tokens, i);
      out.push(...paras);
      i = endIdx + 1;
      continue;
    }

    // Code block / fence
    if (tok.type === "code_block" || tok.type === "fence") {
      out.push(new Paragraph({
        spacing: { before: 100, after: 100 },
        shading: { type: ShadingType.CLEAR, fill: HELIX_PALETTE.LIGHT_GRAY, color: "auto" },
        children: [new TextRun({ text: tok.content, font: FONTS.MONO, size: 20 })],
      }));
      i++;
      continue;
    }

    // Horizontal rule
    if (tok.type === "hr") {
      out.push(new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: HELIX_PALETTE.BLUE } },
        spacing: { before: 200, after: 200 },
        children: [new TextRun({ text: "" })],
      }));
      i++;
      continue;
    }

    // Table
    if (tok.type === "table_open") {
      const { endIdx, table } = renderTable(tokens, i);
      out.push(table);
      i = endIdx + 1;
      continue;
    }

    // html_block — preserve raw as monospace passthrough
    if (tok.type === "html_block") {
      out.push(new Paragraph({
        children: [new TextRun({
          text: tok.content,
          font: FONTS.MONO,
          size: 20,
          color: HELIX_PALETTE.GRAY,
        })],
      }));
      i++;
      continue;
    }

    // Unknown block-level token — passthrough + record
    unmappedTokensCollector.add(`block:${tok.type}`);
    if (tok.content) {
      out.push(new Paragraph({ children: [new TextRun({ text: tok.content, size: 22 })] }));
    }
    i++;
  }

  return out;
}

function renderList(
  tokens: Token[],
  startIdx: number,
  ordered: boolean,
): { endIdx: number; paras: Paragraph[] } {
  const paras: Paragraph[] = [];
  const closeType = ordered ? "ordered_list_close" : "bullet_list_close";
  let counter = 0;
  let i = startIdx + 1;

  while (i < tokens.length && tokens[i].type !== closeType) {
    const tok = tokens[i];
    if (tok.type === "list_item_open") {
      const innerInlines: Token[] = [];
      let j = i + 1;
      while (j < tokens.length && tokens[j].type !== "list_item_close") {
        const ctok = tokens[j];
        if (ctok.type === "inline") {
          innerInlines.push(...(ctok.children ?? []));
        } else if (
          ctok.type !== "paragraph_open" &&
          ctok.type !== "paragraph_close"
        ) {
          // Anything beyond the simple "paragraph-with-inline" shape inside a list item
          // (nested lists, code blocks, blockquotes, etc.) is not yet expanded; record
          // it so drainUnmappedTokens surfaces the gap instead of silently dropping.
          unmappedTokensCollector.add(`list-item-child:${ctok.type}`);
        }
        j++;
      }
      counter++;
      const prefix = ordered ? `${counter}. ` : "\u2022  ";
      paras.push(new Paragraph({
        indent: { left: 360 },
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({
            text: prefix,
            color: HELIX_PALETTE.BLUE,
            bold: true,
            size: 22,
            font: FONTS.BODY,
          }),
          ...hyperlinkedInline(innerInlines),
        ],
      }));
      i = j + 1;
      continue;
    }
    i++;
  }

  return { endIdx: i, paras };
}

function renderBlockquote(
  tokens: Token[],
  startIdx: number,
): { endIdx: number; paras: Paragraph[] } {
  const paras: Paragraph[] = [];
  let i = startIdx + 1;
  while (i < tokens.length && tokens[i].type !== "blockquote_close") {
    if (tokens[i].type === "paragraph_open") {
      const inlineTok = tokens[i + 1];
      const runs = renderInline(inlineTok?.children ?? [], {
        italics: true,
        color: HELIX_PALETTE.GRAY,
        font: FONTS.BODY,
        size: 22,
      });
      paras.push(new Paragraph({
        indent: { left: 360 },
        border: {
          left: { style: BorderStyle.SINGLE, size: 12, color: HELIX_PALETTE.ACCENT, space: 8 },
        },
        spacing: { before: 80, after: 80 },
        children: runs.length ? runs : [new TextRun({ text: "" })],
      }));
      i += 3;
      continue;
    }
    // Non-paragraph content inside the blockquote — record rather than silently skip.
    if (
      tokens[i].type !== "paragraph_close" &&
      tokens[i].type !== "blockquote_open"
    ) {
      unmappedTokensCollector.add(`blockquote-child:${tokens[i].type}`);
    }
    i++;
  }
  return { endIdx: i, paras };
}

function renderTable(
  tokens: Token[],
  startIdx: number,
): { endIdx: number; table: Table } {
  const rows: TableRow[] = [];
  let i = startIdx + 1;
  let zebra = false;
  let isHeader = false;

  while (i < tokens.length && tokens[i].type !== "table_close") {
    const t = tokens[i];
    if (t.type === "thead_open") { isHeader = true; i++; continue; }
    if (t.type === "thead_close") { isHeader = false; i++; continue; }
    if (t.type === "tbody_open" || t.type === "tbody_close") { i++; continue; }

    if (t.type === "tr_open") {
      const cells: TableCell[] = [];
      let j = i + 1;
      while (j < tokens.length && tokens[j].type !== "tr_close") {
        const cellTok = tokens[j];
        if (cellTok.type === "th_open" || cellTok.type === "td_open") {
          const inlineTok = tokens[j + 1];
          const runs = renderInline(inlineTok?.children ?? [], {
            bold: isHeader,
            color: isHeader ? HELIX_PALETTE.WHITE : HELIX_PALETTE.DARK,
            font: FONTS.BODY,
            size: 22,
          });
          cells.push(new TableCell({
            shading: isHeader
              ? { type: ShadingType.CLEAR, fill: HELIX_PALETTE.DARK_BLUE, color: "auto" }
              : zebra
                ? { type: ShadingType.CLEAR, fill: HELIX_PALETTE.LIGHT_GRAY, color: "auto" }
                : { type: ShadingType.CLEAR, fill: HELIX_PALETTE.WHITE, color: "auto" },
            children: [new Paragraph({ children: runs.length ? runs : [new TextRun({ text: "" })] })],
          }));
          j += 3; // xx_open, inline, xx_close
          continue;
        }
        j++;
      }
      rows.push(new TableRow({ children: cells }));
      if (!isHeader) zebra = !zebra;
      i = j + 1;
      continue;
    }
    i++;
  }

  return {
    endIdx: i,
    table: new Table({
      rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top:              { style: BorderStyle.SINGLE, size: 2, color: HELIX_PALETTE.BLUE },
        bottom:           { style: BorderStyle.SINGLE, size: 2, color: HELIX_PALETTE.BLUE },
        left:             { style: BorderStyle.SINGLE, size: 2, color: HELIX_PALETTE.BLUE },
        right:            { style: BorderStyle.SINGLE, size: 2, color: HELIX_PALETTE.BLUE },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: HELIX_PALETTE.BLUE },
        insideVertical:   { style: BorderStyle.SINGLE, size: 1, color: HELIX_PALETTE.BLUE },
      },
    }),
  };
}
