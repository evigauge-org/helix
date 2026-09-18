// lib/firecrawl.ts
// Minimal Firecrawl v1 client — only the two calls our recruitment tools use.
const BASE = "https://api.firecrawl.dev/v1";

export async function firecrawlSearch(
  query: string,
  opts?: { limit?: number; tbs?: string },
): Promise<Array<{ url: string; title?: string; description?: string }>> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return [];
  const res = await fetch(`${BASE}/search`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit: opts?.limit ?? 8, tbs: opts?.tbs }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const rows = Array.isArray(data?.data) ? data.data : [];
  return rows
    .map((r: Record<string, unknown>) => ({
      url: String(r.url ?? ""),
      title: typeof r.title === "string" ? r.title : undefined,
      description: typeof r.description === "string" ? r.description : undefined,
    }))
    .filter((r: { url: string }) => r.url);
}

export async function firecrawlScrape(
  url: string,
  opts?: { onlyMainContent?: boolean; formats?: ("markdown" | "html")[] },
): Promise<{ markdown?: string; html?: string } | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;
  const res = await fetch(`${BASE}/scrape`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      onlyMainContent: opts?.onlyMainContent ?? true,
      formats: opts?.formats ?? ["markdown"],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    markdown: typeof data?.data?.markdown === "string" ? data.data.markdown : undefined,
    html: typeof data?.data?.html === "string" ? data.data.html : undefined,
  };
}
