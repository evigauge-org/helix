// lib/agents/tools/screener/parsers/pros-cons.ts
import type { CheerioAPI } from "cheerio";

/**
 * Reads the Pros / Cons community bullets under the #analysis section.
 * Selectors are tolerant: Screener has used both .pros/.cons and div+h2
 * structures across page revisions.
 */
export function parseProsCons($: CheerioAPI): { pros: string[]; cons: string[] } {
  const pickList = (selector: string): string[] =>
    $(selector)
      .find("li")
      .map((_, li) => $(li).text().trim())
      .get()
      .filter((t) => t.length > 0);

  let pros = pickList("#analysis .pros");
  if (pros.length === 0) pros = pickList(".company-pros, .pros-section ul");
  let cons = pickList("#analysis .cons");
  if (cons.length === 0) cons = pickList(".company-cons, .cons-section ul");
  return { pros, cons };
}
