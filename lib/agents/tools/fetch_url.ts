import { z } from "zod";
import { registerTool } from "../tool-registry";
import type { ToolDef } from "../types";

const schema = z.object({ url: z.string().url() });

const BLOCKED_HOSTS = /^(localhost|.*\.local)$/i;
const BLOCKED_CIDRS = [/^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^169\.254\./, /^0\./];

const tool: ToolDef<typeof schema> = {
  slug: "fetch_url",
  description: "HTTP GET a URL and return readable text (up to 2MB). Use after web_search to read a page in detail.",
  schema,
  async execute(_ctx, { url }) {
    try {
      const u = new URL(url);
      if (BLOCKED_HOSTS.test(u.hostname)) return { ok: false, error: "blocked host" };
      if (/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) && BLOCKED_CIDRS.some((r) => r.test(u.hostname))) {
        return { ok: false, error: "blocked private IP" };
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      let res: Response;
      try {
        res = await fetch(url, { signal: controller.signal, redirect: "follow" });
      } finally {
        clearTimeout(timeout);
      }
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const contentLength = Number(res.headers.get("content-length") ?? "0");
      if (contentLength > 2_000_000) return { ok: false, error: "content too large (>2MB)" };
      const html = await res.text();
      if (html.length > 2_000_000) return { ok: false, error: "content too large (>2MB)" };
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 50_000);
      const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
      return { ok: true, data: { title: titleMatch?.[1]?.trim() ?? url, text, length: text.length } };
    } catch (e) {
      return { ok: false, error: `fetch_url failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  },
};

registerTool(tool);
export default tool;
