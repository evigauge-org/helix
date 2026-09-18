// lib/agents/tools/recruitment/scrape_firm_directory.ts
import { z } from "zod";
import { registerTool } from "../../tool-registry";
import type { ToolDef } from "../../types";
import type { FirmDirectoryResult, DirectoryPerson } from "./types";
import { firecrawlScrape } from "@/lib/firecrawl";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const schema = z.object({
  url: z.string().url(),
  domainTitleKeywords: z.array(z.string()).optional(),
  maxPeople: z.number().int().positive().max(500).default(100),
});

async function extractPeopleWithLlm(
  markdown: string,
  domainTitleKeywords: string[] | undefined,
  maxPeople: number,
): Promise<DirectoryPerson[]> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return [];
  const now = new Date().toISOString();
  const titleHint = domainTitleKeywords?.length
    ? `Prefer entries whose title/role matches one of: ${domainTitleKeywords.join(", ")}.`
    : "";
  const prompt = `You are extracting a structured roster from a firm "People" / "Our Team" page.

Return ONLY valid JSON (no markdown fences) of the form:
{ "people": [ { "name": "...", "title": "...", "profileUrl": "...", "practiceAreas": ["..."] } ] }

Rules:
- Keep up to ${maxPeople} people.
- "profileUrl" is the link to their individual bio page if present on the same domain (absolute URL).
- "practiceAreas" is optional — include only if the page groups people by practice.
- Deduplicate by name.
- ${titleHint}
- Skip contact blocks / press-team / alumni / former-partners sections — current roster only.

PAGE MARKDOWN:
${markdown.slice(0, 60000)}`;

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemma-3-27b-it",
      messages: [
        { role: "system", content: `Current date: ${now.slice(0, 10)}` },
        { role: "user", content: prompt },
      ],
      max_tokens: 6144,
      temperature: 0.1,
    }),
  });
  if (!res.ok) return [];
  const raw = ((await res.json())?.choices?.[0]?.message?.content ?? "") as string;
  const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    const people = Array.isArray(parsed?.people) ? parsed.people : [];
    return people
      .map((p: Record<string, unknown>) => ({
        name: typeof p.name === "string" ? p.name : "",
        title: typeof p.title === "string" ? p.title : undefined,
        profileUrl: typeof p.profileUrl === "string" ? p.profileUrl : undefined,
        practiceAreas: Array.isArray(p.practiceAreas)
          ? (p.practiceAreas as unknown[]).filter((x): x is string => typeof x === "string")
          : undefined,
      }))
      .filter((p: DirectoryPerson) => p.name.length > 0)
      .slice(0, maxPeople);
  } catch {
    return [];
  }
}

const tool: ToolDef<typeof schema> = {
  slug: "scrape_firm_directory",
  description:
    "Given a firm's people page URL (e.g. https://trilegal.com/our-people/), fetch the " +
    "rendered page and extract the roster: { firm, url, people: [{name, title?, profileUrl?, " +
    "practiceAreas?}] }. Use this to SEED targeted LinkedIn searches when the user added a " +
    "firm as a source, and/or to cache the directory for later cross-reference.",
  schema,
  async execute(_ctx, { url, domainTitleKeywords, maxPeople }) {
    const page = await firecrawlScrape(url, { onlyMainContent: true, formats: ["markdown"] });
    if (!page?.markdown) {
      return { ok: false, error: `Firecrawl could not scrape ${url}` };
    }
    const people = await extractPeopleWithLlm(page.markdown, domainTitleKeywords, maxPeople);
    const firm = new URL(url).hostname.replace(/^www\./, "");
    const result: FirmDirectoryResult = { firm, url, people };
    return { ok: true, data: result };
  },
};

registerTool(tool);
export default tool;
