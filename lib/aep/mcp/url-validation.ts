// lib/aep/mcp/url-validation.ts
//
// SSRF mitigation for external MCP server URLs. Users supply arbitrary URLs;
// without filtering they could point the runner at internal-only addresses
// and inspect responses via tool-call results (cloud metadata, internal
// services, etc.).
//
// Limitations: this is hostname/IP-string filtering only. A motivated
// attacker can still bypass via DNS rebinding (hostname resolves to a
// public IP at validation time, then to a private IP at connect time).
// True SSRF protection needs resolve-then-connect with address-family
// guards at connect time. v1 raises the bar without claiming watertight.

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "0.0.0.0",
  "::",
  "::1",
]);

/** Match RFC 1918, loopback, link-local, unique-local IPv4/IPv6 literals. */
function looksLikeInternalIp(host: string): boolean {
  // Strip IPv6 brackets if present (e.g. "[::1]")
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();

  // IPv6 literals
  if (h.includes(":")) {
    if (h === "::1" || h === "::") return true;
    if (h.startsWith("fc") || h.startsWith("fd")) return true;       // fc00::/7 unique-local
    if (h.startsWith("fe80:") || h.startsWith("fe9") || h.startsWith("fea") || h.startsWith("feb")) return true; // fe80::/10 link-local
    return false;
  }

  // IPv4 dotted quads
  const parts = h.split(".");
  if (parts.length !== 4 || !parts.every((p) => /^\d+$/.test(p))) return false;
  const [a, b] = parts.map((p) => parseInt(p, 10));
  if (parts.some((p) => parseInt(p, 10) > 255)) return false;
  if (a === 127) return true;                                          // 127.0.0.0/8 loopback
  if (a === 10) return true;                                           // 10.0.0.0/8 RFC 1918
  if (a === 172 && b >= 16 && b <= 31) return true;                    // 172.16.0.0/12 RFC 1918
  if (a === 192 && b === 168) return true;                             // 192.168.0.0/16 RFC 1918
  if (a === 169 && b === 254) return true;                             // 169.254.0.0/16 link-local (incl. cloud metadata 169.254.169.254)
  if (a === 0) return true;                                            // 0.0.0.0/8
  return false;
}

export function validateExternalMcpUrl(raw: string): { ok: true } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "invalid_url" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "unsupported_protocol" };
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) return { ok: false, error: "internal_host_blocked" };
  if (looksLikeInternalIp(host)) return { ok: false, error: "internal_host_blocked" };
  return { ok: true };
}
