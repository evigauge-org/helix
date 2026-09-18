import { PageIndexClient } from "@pageindex/sdk";

let cached: PageIndexClient | null = null;

export function getPageIndexClient(): PageIndexClient {
  if (cached) return cached;
  const apiKey = process.env.PAGEINDEX_API_KEY;
  if (!apiKey) {
    throw new Error("PAGEINDEX_API_KEY is not configured");
  }
  cached = new PageIndexClient({ apiKey });
  return cached;
}
