import DOMPurify from "isomorphic-dompurify";

const ALLOWED_HOSTS = new Set([
  "cdn.jsdelivr.net",
  "unpkg.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
]);

function isAllowedSrc(src: string | null): boolean {
  if (!src) return false;
  try {
    const u = new URL(src);
    return ALLOWED_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

// Strips on* event handler attributes from an HTML fragment.
function stripEventHandlers(html: string): string {
  // Remove attrs of the form on<word>="..." / on<word>='...' / on<word>=value
  return html.replace(
    /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
    "",
  );
}

// Strips javascript: URLs from href/src/xlink:href attrs.
function stripJavascriptUrls(html: string): string {
  return html.replace(
    /\s+(href|src|xlink:href)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]*)/gi,
    "",
  );
}

// Forbidden tags (plus their content) — including <script> with non-allowlisted src.
function stripForbiddenTags(html: string): string {
  const FORBID = ["iframe", "object", "embed", "form", "input", "textarea", "select", "button"];
  let out = html;
  for (const tag of FORBID) {
    // Paired tags with content
    const paired = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
    out = out.replace(paired, "");
    // Self-closing / void or unclosed
    const single = new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi");
    out = out.replace(single, "");
  }
  return out;
}

function filterScriptsAndLinks(html: string): string {
  // External <script src="..."> — keep only if allowlisted host.
  let out = html.replace(
    /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi,
    (full: string, src: string) => (isAllowedSrc(src) ? full : ""),
  );
  // <link ... href="..."> — keep only if allowlisted host.
  out = out.replace(
    /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/gi,
    (full: string, href: string) => (isAllowedSrc(href) ? full : ""),
  );
  return out;
}

// Sanitize non-script HTML segments via DOMPurify while leaving <script>...</script>
// blocks intact (we handle those manually).
function sanitizeNonScript(html: string): string {
  const SCRIPT_RE = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
  const placeholders: string[] = [];
  const withPlaceholders = html.replace(SCRIPT_RE, (match) => {
    const token = `__HELIX_SCRIPT_${placeholders.length}__`;
    placeholders.push(match);
    return token;
  });

  const cleaned = DOMPurify.sanitize(withPlaceholders, {
    ADD_TAGS: [
      "style", "canvas",
      "svg", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
      "g", "defs", "use", "linearGradient", "radialGradient", "stop",
      "text", "tspan", "title", "desc", "marker",
    ],
    ADD_ATTR: [
      "target", "viewBox", "d", "fill", "stroke", "stroke-width", "transform",
      "cx", "cy", "r", "x", "y", "x1", "y1", "x2", "y2", "points",
      "offset", "stop-color", "preserveAspectRatio",
    ],
    FORBID_TAGS: ["iframe", "object", "embed", "form", "input", "textarea", "select", "button"],
    ALLOW_DATA_ATTR: true,
  });

  return cleaned.replace(/__HELIX_SCRIPT_(\d+)__/g, (_m, i: string) => placeholders[Number(i)] ?? "");
}

export function sanitizeDashboard(html: string): string {
  // 1. Strip obvious forbidden tags first (defence in depth).
  let out = stripForbiddenTags(html);
  // 2. Strip on* event handlers.
  out = stripEventHandlers(out);
  // 3. Strip javascript: URLs.
  out = stripJavascriptUrls(out);
  // 4. DOMPurify pass (script blocks preserved via placeholders).
  out = sanitizeNonScript(out);
  // 5. Filter scripts/links by allowlist.
  out = filterScriptsAndLinks(out);
  return out;
}
