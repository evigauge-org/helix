import { randomUUID } from "crypto";
import type {
  StoreBrief, ResearchOutput, BrandingOutput, BrandingSections,
  EditableSection, SectionVersion,
} from "./types";
import { MARKET_SEGMENT_DESCRIPTIONS, resolveMarket } from "./markets";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function aiGenerate(prompt: string): Promise<string> {
  if (!OPENROUTER_API_KEY) throw new Error("OpenRouter not configured");
  const now = new Date().toISOString();
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemma-3-27b-it",
      messages: [
        { role: "system", content: `Current date: ${now.slice(0, 10)} (ISO ${now}).` },
        { role: "user", content: prompt },
      ],
      max_tokens: 4096,
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter error ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function generateLogo(brandName: string, style: string): Promise<string> {
  if (!OPENAI_API_KEY) return "";
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: `Minimal modern logo for "${brandName}", a ${style} brand. Clean vector style, white background, simple iconic design, no text.`,
        n: 1,
        size: "1024x1024",
      }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.data?.[0]?.url ?? "";
  } catch {
    return "";
  }
}

function freshSection<T>(id: string, content: T): EditableSection<T> {
  const versionId = randomUUID();
  const version: SectionVersion<T> = { id: versionId, content, author: "ai", createdAt: new Date().toISOString() };
  return { id, versions: [version], activeVersionId: versionId };
}

export async function runBranding(brief: StoreBrief, research: ResearchOutput, approvedContext?: string): Promise<BrandingOutput> {
  const nicheStr = brief.niche.join(", ");
  const marketNames = brief.markets.map((m) => resolveMarket(m).name).join(", ");
  const competitorNames = research.competitiveLandscape.slice(0, 3).map((c) => c.name).join(", ") || "(none)";

  const categoryLabel = brief.brandCategory === "other" && brief.brandCategoryCustom
    ? brief.brandCategoryCustom
    : brief.brandCategory;
  const contextBlock = approvedContext ? `\n\n${approvedContext}` : "";

  const prompt = `You are a brand strategist. Create a complete brand identity.

BRAND BRIEF:
- Category: ${categoryLabel}
- Niche: ${nicheStr}
- Products: ${brief.products.join(", ")}
- Audience: ${brief.audience}
- Market segment: ${brief.marketSegment} (${MARKET_SEGMENT_DESCRIPTIONS[brief.marketSegment]})
- Target markets: ${marketNames}

Market context: ${research.marketAnalysis.slice(0, 500)}
Competitors: ${competitorNames}

NAMING CONSTRAINTS:
- Produce names + taglines that work across the user's target markets (${marketNames}) — pronounceable, non-offensive, transliteration-friendly. Avoid English puns that rely on specific local idioms.
${contextBlock}

Return ONLY valid JSON (no markdown fences):
{
  "nameOptions": [
    {"name": "BRANDNAME", "tagline": "Short punchy tagline", "domainAvailable": true, "reasoning": "Why this name works..."}
  ],
  "selectedName": "BRANDNAME",
  "colors": {
    "primary": "#hex", "secondary": "#hex", "accent": "#hex",
    "neutral": "#hex", "background": "#hex", "text": "#hex"
  },
  "typography": {"heading": "Google Font Name", "body": "Google Font Name", "reasoning": "Why this pairing..."},
  "logoUrls": [],
  "selectedLogo": "",
  "brandVoice": {
    "tone": "edgy-casual",
    "dos": ["Do this", "Do that", "Do this too"],
    "donts": ["Don't do this", "Don't do that"],
    "sampleProductDesc": "A sample product description in brand voice...",
    "sampleCaption": "A sample Instagram caption in brand voice..."
  },
  "brandKitUrl": ""
}

Generate exactly 5 name options. Pick the best as selectedName. Colors should reflect the ${nicheStr} aesthetic for ${brief.audience} in the ${brief.marketSegment} segment. Typography should use Google Fonts that fit the brand personality.`;

  const raw = await aiGenerate(prompt);
  const jsonStr = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  const parsed: Omit<BrandingOutput, "sections"> = JSON.parse(jsonStr);

  const logoPromises = [1, 2, 3].map(() => generateLogo(parsed.selectedName, nicheStr));
  const logos = await Promise.all(logoPromises);
  parsed.logoUrls = logos.filter(Boolean);
  parsed.selectedLogo = parsed.logoUrls[0] ?? "";

  const sections: BrandingSections = {
    nameOptions: freshSection("nameOptions", parsed.nameOptions),
    colors:      freshSection("colors", parsed.colors),
    typography:  freshSection("typography", parsed.typography),
    brandVoice:  freshSection("brandVoice", parsed.brandVoice),
  };

  return { ...parsed, sections };
}
