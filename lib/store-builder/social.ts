import { randomUUID } from "crypto";
import type {
  StoreBrief, BrandingOutput, ResearchOutput, SocialOutput, SocialSections,
  EditableSection, SectionVersion, SuggestedCaption,
} from "./types";
import { resolveMarket } from "./markets";

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

async function generateCoverImage(prompt: string): Promise<string> {
  if (!OPENAI_API_KEY) return "";
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "dall-e-3", prompt, n: 1, size: "1792x1024" }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.data?.[0]?.url ?? "";
  } catch {
    return "";
  }
}

function freshSection<T>(id: string, content: T): EditableSection<T> {
  const vid = randomUUID();
  const version: SectionVersion<T> = { id: vid, content, author: "ai", createdAt: new Date().toISOString() };
  return { id, versions: [version], activeVersionId: vid };
}

export async function runSocial(
  brief: StoreBrief,
  branding: BrandingOutput,
  research: ResearchOutput,
  approvedContext?: string,
): Promise<SocialOutput> {
  const { selectedName, colors, brandVoice } = branding;
  const tagline = branding.nameOptions.find((n) => n.name === selectedName)?.tagline ?? "";
  const categoryLabel = brief.brandCategory === "other" && brief.brandCategoryCustom
    ? brief.brandCategoryCustom
    : brief.brandCategory;
  const contextBlock = approvedContext ? `\n\n${approvedContext}` : "";

  // Step 1: Carousel via the existing API
  let carouselHtml = "";
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const carouselRes = await fetch(`${baseUrl}/api/carousel/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: `${selectedName} — ${tagline}. Brand launch for a ${brandVoice.tone} ${categoryLabel} brand.`,
        brandName: selectedName,
      }),
    });
    if (carouselRes.ok) {
      const carouselData = await carouselRes.json();
      carouselHtml = carouselData.html ?? "";
    }
  } catch {
    // Leave empty on failure
  }

  // Step 2: Cover images via DALL-E
  const basePrompt = `Minimalist ${categoryLabel} brand cover image for "${selectedName}". Colors: ${colors.primary} and ${colors.secondary}. ${brandVoice.tone} aesthetic. No text overlay.`;
  const [instagram, facebook, shopifyHero] = await Promise.all([
    generateCoverImage(`${basePrompt} Square format, Instagram profile style.`),
    generateCoverImage(`${basePrompt} Wide panoramic banner, Facebook cover style.`),
    generateCoverImage(`${basePrompt} Ultra-wide hero banner, e-commerce homepage style.`),
  ]);

  // Step 3: Captions with market-aware pricing language
  const primary = research.pricingStrategy[0];
  const primaryMarketCode = brief.markets[0] ?? "us";
  const primaryMarket = resolveMarket(primaryMarketCode);
  const segmentLine =
    brief.marketSegment === "budget"  ? `Emphasize value; use phrasing like "under ${primary?.symbol ?? primaryMarket.symbol}${primary?.low ?? ""}".` :
    brief.marketSegment === "premium" ? `Emphasize craftsmanship; use phrasing like "starting at ${primary?.symbol ?? primaryMarket.symbol}${primary?.mid ?? ""}".` :
    brief.marketSegment === "luxury"  ? `Emphasize exclusivity; don't mention price prominently.` :
    `Emphasize value + quality balance.`;

  const captionsPrompt = `Generate 5 Instagram launch captions for "${selectedName}".
Tone: ${brandVoice.tone}
Sample style: ${brandVoice.sampleCaption}
Category: ${categoryLabel}
Primary market: ${primaryMarketCode} (currency ${primary?.currency ?? primaryMarket.code} ${primary?.symbol ?? primaryMarket.symbol}).
Pricing hint: ${segmentLine}
${contextBlock}

Return ONLY valid JSON array (no markdown):
[{"text":"Caption text...","hashtags":["tag1","tag2","tag3","tag4","tag5"]}]`;

  const captionsRaw = await aiGenerate(captionsPrompt);
  const captionsJson = captionsRaw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  let suggestedCaptions: SuggestedCaption[] = [];
  try {
    suggestedCaptions = JSON.parse(captionsJson);
  } catch {
    suggestedCaptions = [{ text: `${selectedName} is here. Are you ready?`, hashtags: ["newbrand", categoryLabel] }];
  }

  const hashtagSet = Array.from(new Set(suggestedCaptions.flatMap((c) => c.hashtags)));

  const sections: SocialSections = {
    captionTemplates: freshSection("captionTemplates", suggestedCaptions),
    hashtagSet:       freshSection("hashtagSet", hashtagSet),
  };

  return {
    carouselHtml,
    coverImages: {
      instagram: instagram || "",
      facebook: facebook || "",
      shopifyHero: shopifyHero || "",
    },
    suggestedCaptions,
    hashtagSet,
    assetsZipUrl: "",
    sections,
  };
}
