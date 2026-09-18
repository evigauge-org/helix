// lib/research/tools.ts
import { z } from "zod";
import type { ToolDef } from "@/lib/agents/types";
import { getExaClient } from "@/lib/exa";
import fetchUrlTool from "@/lib/agents/tools/fetch_url";

export type Source = { index: number; title: string; url: string; snippet: string; published?: string };

export function buildResearchTools(): { tools: ToolDef[]; getSources: () => Source[] } {
  const sources: Source[] = [];
  const seen = new Map<string, number>();

  const searchSchema = z.object({ query: z.string().min(1).max(500) });
  const search: ToolDef<typeof searchSchema> = {
    slug: "web_search",
    description:
      "Search the web. Returns ranked results, each with an [n] citation index, title, url, and snippet. Cite facts using these [n] indices.",
    schema: searchSchema,
    async execute(_ctx, { query }) {
      const exa = getExaClient();
      if (!exa) return { ok: false, error: "Exa client not configured" };
      try {
        const res = await exa.searchAndContents(query, {
          numResults: 5,
          useAutoprompt: true,
          livecrawl: "always",
          text: { maxCharacters: 800 },
        } as Parameters<typeof exa.searchAndContents>[1]);
        const results = (res.results ?? []).map((r) => {
          const raw = r as { title?: string | null; url: string; text?: string; publishedDate?: string };
          let index = seen.get(raw.url);
          if (index === undefined) {
            index = sources.length + 1;
            seen.set(raw.url, index);
            sources.push({
              index,
              title: raw.title ?? raw.url,
              url: raw.url,
              snippet: (raw.text ?? "").slice(0, 800),
              published: raw.publishedDate,
            });
          }
          return { index, title: raw.title ?? raw.url, url: raw.url, snippet: (raw.text ?? "").slice(0, 800) };
        });
        return { ok: true, data: { results } };
      } catch (e) {
        return { ok: false, error: `web_search failed: ${e instanceof Error ? e.message : String(e)}` };
      }
    },
  };

  const todoSchema = z.object({
    tasks: z.array(z.object({ task: z.string(), done: z.boolean() })).max(20),
  });
  const todoWrite: ToolDef<typeof todoSchema> = {
    slug: "todo_write",
    description:
      "Record/update a research task list for complex multi-topic queries. Returns { completedCount, totalCount }.",
    schema: todoSchema,
    async execute(_ctx, { tasks }) {
      const completedCount = tasks.filter((t) => t.done).length;
      return { ok: true, data: { completedCount, totalCount: tasks.length } };
    },
  };

  // fetch_url is reused as-is (SSRF guards + 50k cap already implemented).
  return { tools: [search, fetchUrlTool, todoWrite], getSources: () => sources };
}
