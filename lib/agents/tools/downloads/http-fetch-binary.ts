export const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024; // 20MB
export const DOWNLOAD_TIMEOUT_MS = 20_000;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

export function isBlockedHost(hostname: string): boolean {
  // Node's URL parser returns IPv6 literals wrapped in brackets, e.g.
  // `new URL("http://[::1]/").hostname === "[::1]"`. Strip the brackets
  // so our IPv6 checks can see the raw address.
  const raw = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
  const h = raw.toLowerCase();

  // --- Hostnames + IPv4 blocklist ---
  if (h === "localhost" || h === "0.0.0.0") return true;
  if (/\.local$/.test(h)) return true;
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  const m172 = /^172\.(\d+)\./.exec(h);
  if (m172) {
    const octet = parseInt(m172[1], 10);
    if (octet >= 16 && octet <= 31) return true;
  }

  // --- IPv6 literals ---
  // Unspecified + loopback
  if (h === "::" || h === "::1") return true;
  // Unique local fc00::/7 — first hextet begins fc or fd
  if (/^f[cd][0-9a-f]{0,2}:/.test(h)) return true;
  // Link-local fe80::/10 — first hextet begins fe8, fe9, fea, feb
  if (/^fe[89ab][0-9a-f]?:/.test(h)) return true;
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — recursively check the embedded v4
  const mapped = /^::ffff:([0-9.]+)$/.exec(h);
  if (mapped) return isBlockedHost(mapped[1]);

  return false;
}

function parseFilename(contentDisposition: string | null, url: string): string | null {
  if (contentDisposition) {
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(contentDisposition);
    if (m) return decodeURIComponent(m[1]).trim();
  }
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").filter(Boolean).pop();
    if (last) return decodeURIComponent(last);
  } catch {}
  return null;
}

export type BinaryDownloadResult = {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
};

export async function fetchBinary(params: {
  url: string;
  referer?: string;
  filenameOverride?: string;
}): Promise<BinaryDownloadResult> {
  const { url, referer, filenameOverride } = params;

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    throw new Error("invalid url");
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") {
    throw new Error("only http/https allowed");
  }
  if (isBlockedHost(target.hostname)) {
    throw new Error("blocked host");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    const cookieJar: string[] = [];
    if (referer) {
      try {
        const warmRes = await fetch(referer, {
          method: "GET",
          signal: controller.signal,
          headers: {
            "User-Agent": BROWSER_UA,
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
          redirect: "follow",
        });
        const getSetCookie = (warmRes.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
        if (typeof getSetCookie === "function") {
          for (const c of getSetCookie.call(warmRes.headers)) {
            const semi = c.indexOf(";");
            cookieJar.push(semi === -1 ? c : c.slice(0, semi));
          }
        } else {
          const single = warmRes.headers.get("set-cookie");
          if (single) {
            for (const part of single.split(/,(?=\s*[A-Za-z0-9_-]+=)/g)) {
              const semi = part.indexOf(";");
              cookieJar.push(semi === -1 ? part.trim() : part.slice(0, semi).trim());
            }
          }
        }
      } catch {}
    }

    const headers: Record<string, string> = {
      "User-Agent": BROWSER_UA,
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
    };
    if (referer) headers["Referer"] = referer;
    if (cookieJar.length > 0) headers["Cookie"] = cookieJar.join("; ");

    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers,
      redirect: "follow",
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const declared = res.headers.get("content-length");
    if (declared && parseInt(declared, 10) > MAX_DOWNLOAD_BYTES) {
      throw new Error("file too large (>20MB)");
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("no response body");
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_DOWNLOAD_BYTES) {
          try { await reader.cancel(); } catch {}
          throw new Error("file too large (>20MB)");
        }
        chunks.push(value);
      }
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.byteLength;
    }

    const mimeType =
      res.headers.get("content-type")?.split(";")[0]?.trim() ||
      "application/octet-stream";
    const filename =
      filenameOverride ??
      parseFilename(res.headers.get("content-disposition"), url) ??
      `download-${Date.now()}`;

    return { bytes, mimeType, filename };
  } finally {
    clearTimeout(timeout);
  }
}

export function encodeBinaryArtifact(bytes: Uint8Array, mimeType: string): string {
  const b64 = Buffer.from(bytes).toString("base64");
  return `data:${mimeType};base64,${b64}`;
}
