// lib/docx/md-to-docx.ts
import MarkdownIt from "markdown-it";
 
// @ts-expect-error — markdown-it-task-lists ships no types
import taskLists from "markdown-it-task-lists";
import { Document } from "docx";
import { renderTokens, drainUnmappedTokens } from "./tokens";
import { buildCoverPage, buildFooter, buildHeaderRule } from "./helix-theme";

export interface RenderMarkdownOptions {
  title: string;
  markdown: string;
  subtitle?: string;
  author?: string;
  coverPage?: boolean;
}

export interface RenderMarkdownResult {
  document: Document;
  tokenCount: number;
  unmappedTokens: string[];
}

export function renderMarkdownToDocx(opts: RenderMarkdownOptions): RenderMarkdownResult {
  const author = opts.author ?? "Helix Intelligence";
  const md = new MarkdownIt({ html: true, linkify: true, typographer: false })
    .use(taskLists as unknown as (md: MarkdownIt) => void);

  const tokens = md.parse(opts.markdown, {});
  drainUnmappedTokens(); // clear any stale state from prior runs

  const body = renderTokens(tokens);
  const unmapped = drainUnmappedTokens();

  const coverParas = opts.coverPage !== false
    ? buildCoverPage({ title: opts.title, subtitle: opts.subtitle, author })
    : [];

  const document = new Document({
    creator: "Helix Intelligence",
    title: opts.title,
    description: opts.subtitle,
    sections: [
      {
        headers: { default: buildHeaderRule() },
        footers: { default: buildFooter(author) },
        children: [...coverParas, ...body],
      },
    ],
  });

  return { document, tokenCount: tokens.length, unmappedTokens: unmapped };
}
