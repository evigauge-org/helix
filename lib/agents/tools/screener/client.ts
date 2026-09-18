// lib/agents/tools/screener/client.ts

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Referer": "https://www.screener.in/",
  "Cache-Control": "no-cache",
};

export type FetchResult =
  | { ok: true; html: string; finalUrl: string }
  | { ok: false; error: string; status?: number };

export async function fetchScreenerHtml(args: {
  ticker: string;
  segment: "standalone" | "consolidated";
  timeoutMs?: number;
}): Promise<FetchResult> {
  const ticker = args.ticker.trim().toUpperCase();
  const path = args.segment === "consolidated"
    ? `/company/${encodeURIComponent(ticker)}/consolidated/`
    : `/company/${encodeURIComponent(ticker)}/`;
  const url = `https://www.screener.in${path}`;
  const timeoutMs = args.timeoutMs ?? 15_000;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: BROWSER_HEADERS,
      signal: controller.signal,
      redirect: "follow",
    });
    if (res.status === 404) {
      return { ok: false, error: `ticker '${ticker}' not found on Screener.in`, status: 404 };
    }
    if (res.status === 403) {
      return {
        ok: false,
        error:
          "Screener.in blocked the request (403) — try again later or use run_code with a custom User-Agent",
        status: 403,
      };
    }
    if (!res.ok) {
      return { ok: false, error: `Screener.in returned ${res.status}`, status: res.status };
    }
    const html = await res.text();
    return { ok: true, html, finalUrl: url };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, error: `Screener.in unreachable: timeout after ${timeoutMs} ms` };
    }
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Screener.in fetch failed: ${msg}` };
  } finally {
    clearTimeout(timeout);
  }
}
