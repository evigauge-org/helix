// lib/agents/tools/ib/shared/headers.ts
// Cloudflare-passing browser-like headers. Mirrors the existing screener
// scraper pattern so anti-bot heuristics don't block our requests.

export function browserHeaders(opts?: { referer?: string; accept?: string }): HeadersInit {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    Accept: opts?.accept ??
      "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.5",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    Referer: opts?.referer ?? "https://www.google.com/",
    "Cache-Control": "no-cache",
  };
}

// SEC requires a self-identifying User-Agent per its fair-use policy
// (https://www.sec.gov/os/accessing-edgar-data). Pulled from env.
export function secEdgarHeaders(): HeadersInit {
  const ua = process.env.SEC_EDGAR_USER_AGENT;
  if (!ua) {
    throw new Error("SEC_EDGAR_USER_AGENT not configured (e.g. 'Helix ops@helix.ai')");
  }
  return {
    "User-Agent": ua,
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
  };
}
