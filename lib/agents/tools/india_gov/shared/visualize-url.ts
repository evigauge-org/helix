// lib/agents/tools/india_gov/shared/visualize-url.ts
// Best-effort URL constructor for the visualize.data.gov.in chart view of a
// resourceId. data.gov.in's visualize subdomain accepts the resourceId as a
// path segment for many (not all) public resources; we surface the URL
// regardless and let the user click through. If the visualize page 404s
// for that resource, the click-through degrades gracefully.

const BASE = "https://visualize.data.gov.in/?inst=";

export function visualizeUrlFor(resourceId: string): string | null {
  if (!resourceId) return null;
  return `${BASE}${encodeURIComponent(resourceId)}`;
}
