// app/api/recruitment/brief/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { ApifyInput, ValidationBrief } from "@/lib/agents/tools/recruitment/types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

interface BriefResponse {
  filters: Partial<ApifyInput>;
  validation: ValidationBrief;
  suggestedSources: string[];
  suggestedRefinements: string[];
  agentName: string;
  agentGoal: string;
}

const SYSTEM_PROMPT = `You are a recruitment-brief parser for the Helix agent system.

Given a natural-language sourcing request, return ONLY a JSON object (no markdown fences)
with this exact shape:

{
  "filters": {
    "searchQuery": "short 1-4 word query hint, e.g. 'corporate lawyer'",
    "locations": ["Mumbai"],
    "seniorityLevelIds": ["120"],
    "functionIds": ["14"],
    "industryIds": [],
    "yearsOfExperienceIds": ["4"],
    "currentJobTitles": ["Associate","Partner"],
    "pastJobTitles": [],
    "schools": [],
    "autoQuerySegmentationTargetCountries": ["IN"],
    "profileScraperMode": "Full + email search",
    "maxItems": 20,
    "autoQuerySegmentation": true
  },
  "validation": {
    "minPqe": 6,
    "mustStillBeInDomain": true,
    "domainTitleKeywords": ["lawyer","attorney","counsel","advocate"],
    "domainIndustryKeywords": ["law firm","legal services","corporate law"],
    "domainCompanyHints": ["Trilegal","AZB","Khaitan","Amarchand"]
  },
  "suggestedSources": ["https://trilegal.com/our-people/"],
  "suggestedRefinements": [
    "Narrow by past employer (e.g. tier-1 Indian law firms).",
    "Add a specific school filter (e.g. NLSIU, NALSAR)."
  ],
  "agentName": "Mumbai Law Sourcer",
  "agentGoal": "Source up to 20 senior corporate lawyers in Mumbai with 6+ yrs PQE, validate currently in-domain, produce sheet + dossier."
}

Mapping rules:
- LinkedIn function IDs: 1=Accounting 2=Administrative 3=Arts/Design 4=BizDev 5=Community
  6=Consulting 7=Education 8=Engineering 9=Entrepreneurship 10=Finance 11=Healthcare 12=HR
  13=IT 14=Legal 15=Marketing 16=Media/Comm 17=Military 18=Operations 19=Product 20=Program/PM
  21=Purchasing 22=QA 23=RealEstate 24=Research 25=Sales 26=Customer
- Seniority IDs: 100=InTraining 110=Entry 120=Senior 130=Strategic 200=EntryMgr 210=ExpMgr
  220=Director 300=VP 310=CXO 320=Owner/Partner
- YoE IDs: 1=<1y 2=1-2y 3=3-5y 4=6-10y 5=10+y
- ALWAYS compute a numeric minPqe even when only YoE ID is given (e.g. id "4" → minPqe 6).
- Set mustStillBeInDomain: true by default.
- Populate domainTitleKeywords with 4-8 lowercase role-synonyms.
- Populate domainCompanyHints with 3-6 reputable firms in that space (India-specific when the
  target country is IN).
- suggestedSources: 1-3 firm-directory URLs plausible for the domain — pick real sites you
  know exist (trilegal.com/our-people/, martindale.com, justia.com for US law, etc.).
  Only include if you're confident the URL exists.
- suggestedRefinements: 2-4 short actionable tips (≤ 100 chars each).
- agentName: 2-5 words, location + function flavor.
- agentGoal: 1-2 sentences framing the output.`;

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { query?: string };
  const query = (body.query ?? "").trim();
  if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return NextResponse.json({ error: "OpenRouter not configured" }, { status: 500 });

  const now = new Date().toISOString();
  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemma-3-27b-it",
        messages: [
          { role: "system", content: `Current date: ${now.slice(0, 10)}` },
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `User request:\n${query}` },
        ],
        max_tokens: 2048,
        temperature: 0.2,
      }),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `LLM fetch failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }
  if (!res.ok) {
    return NextResponse.json({ error: `LLM ${res.status}` }, { status: 502 });
  }
  const data = await res.json();
  const raw = (data?.choices?.[0]?.message?.content ?? "") as string;
  const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();

  let parsed: BriefResponse;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json(
      { error: "LLM produced invalid JSON", raw: cleaned.slice(0, 500) },
      { status: 502 },
    );
  }

  // Minimal defence: ensure the core fields exist.
  parsed.filters = parsed.filters ?? {};
  parsed.validation = parsed.validation ?? { mustStillBeInDomain: true };
  parsed.suggestedSources = Array.isArray(parsed.suggestedSources) ? parsed.suggestedSources : [];
  parsed.suggestedRefinements = Array.isArray(parsed.suggestedRefinements) ? parsed.suggestedRefinements : [];
  parsed.agentName = typeof parsed.agentName === "string" ? parsed.agentName : "Recruitment Agent";
  parsed.agentGoal = typeof parsed.agentGoal === "string" ? parsed.agentGoal : query;

  return NextResponse.json(parsed);
}
