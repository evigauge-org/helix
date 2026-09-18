import { z } from "zod";
import { registerTool } from "../tool-registry";
import type { ToolDef } from "../types";
import { getExaClient } from "@/lib/exa";

const schema = z.object({ query: z.string().min(1).max(500) });

const tool: ToolDef<typeof schema> = {
  slug: "web_search",
  description: "Search the web and return top 5 recent results with title, url, and snippet. Use for factual lookups, current events, or any research task.",
  schema,
  async execute(_ctx, { query }) {
    const exa = getExaClient();
    if (!exa) return { ok: false, error: "Exa client not configured" };
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    try {
      const res = await exa.searchAndContents(query, {
        numResults: 5,
        useAutoprompt: true,
        livecrawl: "always",
        startPublishedDate: ninetyDaysAgo,
        text: { maxCharacters: 600 },
      } as Parameters<typeof exa.searchAndContents>[1]);
      const results = (res.results ?? []).map((r) => {
        const raw = r as { title?: string | null; url: string; text?: string; publishedDate?: string };
        return {
          title: raw.title ?? raw.url,
          url: raw.url,
          snippet: (raw.text ?? "").slice(0, 600),
          published: raw.publishedDate,
        };
      });
      return { ok: true, data: { results } };
    } catch (e) {
      return { ok: false, error: `web_search failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  },
};

registerTool(tool);
export default tool;
