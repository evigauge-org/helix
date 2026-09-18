// lib/store-builder/research.ts
import { getExaClient } from "@/lib/exa";
import { randomUUID } from "crypto";
import type {
  StoreBrief,
  ResearchOutput,
  ResearchSections,
  Competitor,
  AudienceProfile,
  ProductRecommendation,
  MarketPricingTier,
  SectionVersion,
  EditableSection,
} from "./types";
import { MARKET_SEGMENT_DESCRIPTIONS, resolveMarket } from "./markets";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

async function searchExa(queries: string[]): Promise<string[]> {
  const exa = getExaClient();
  if (!exa) return [];
  const results: string[] = [];
  for (const query of queries) {
    try {
      const res = await exa.searchAndContents(query, { type: "auto", numResults: 5, text: true });
      for (const r of res.results) {
        results.push(`## ${r.title}\nURL: ${r.url}\n${r.text?.slice(0, 2000) ?? ""}`);
      }
    } catch {}
  }
  return results;
}

async function aiSynthesize(prompt: string): Promise<string> {
  if (!OPENROUTER_API_KEY) throw new Error("OpenRouter not configured");
  const now = new Date().toISOString();
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemma-3-27b-it",
      messages: [
        { role: "system", content: `Current date: ${now.slice(0, 10)} (ISO ${now}). Use this for "latest"/"today" reasoning.` },
        { role: "user", content: prompt },
      ],
      max_tokens: 6000,
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter error ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function briefHeader(brief: StoreBrief): string {
  const categoryLabel =
    brief.brandCategory === "other" && brief.brandCategoryCustom
      ? `other (${brief.brandCategoryCustom})`
      : brief.brandCategory;
  const marketsLine = brief.markets
    .map((m) => {
      const c = resolveMarket(m);
      return `${m} (${c.name}, ${c.code})`;
    })
    .join(", ");
  return [
    `Brand brief:`,
    `- Category: ${categoryLabel}`,
    `- Niche: ${brief.niche.join(", ")}`,
    `- Products: ${brief.products.join(", ")}`,
    `- Target audience: ${brief.audience}`,
    `- Target markets: ${marketsLine}`,
    `- Market segment: ${brief.marketSegment} (${MARKET_SEGMENT_DESCRIPTIONS[brief.marketSegment]})`,
    `- Catalog size: ${brief.scale}`,
  ].join("\n");
}

function categoryExaQueries(brief: StoreBrief): string[] {
  const nicheStr = brief.niche.join(", ");
  const prodStr = brief.products.join(", ");
  switch (brief.brandCategory) {
    case "clothing":
      return [
        `${nicheStr} clothing market trends 2026`,
        `top ${nicheStr} fashion brands competitor analysis`,
        `${nicheStr} clothing pricing strategy ${brief.audience}`,
      ];
    case "electronics":
      return [
        `${nicheStr} consumer electronics market trends 2026`,
        `top ${nicheStr} brands competitor analysis ${prodStr}`,
        `${nicheStr} electronics pricing ${brief.audience} ${brief.marketSegment}`,
      ];
    case "digital":
      return [
        `${nicheStr} digital product market 2026`,
        `top ${nicheStr} digital brands competitors`,
        `${nicheStr} SaaS pricing tiers 2026`,
      ];
    case "other":
    default:
      return [
        `${brief.brandCategoryCustom ?? nicheStr} market trends 2026`,
        `top ${brief.brandCategoryCustom ?? nicheStr} brands competitor analysis`,
        `${brief.brandCategoryCustom ?? nicheStr} pricing ${brief.audience}`,
      ];
  }
}

function freshSection<T>(sectionId: string, content: T): EditableSection<T> {
  const versionId = randomUUID();
  const version: SectionVersion<T> = {
    id: versionId,
    content,
    author: "ai",
    createdAt: new Date().toISOString(),
  };
  return { id: sectionId, versions: [version], activeVersionId: versionId };
}

export async function runResearch(brief: StoreBrief, approvedContext?: string): Promise<ResearchOutput> {
  const searchResults = await searchExa(categoryExaQueries(brief));
  const searchContext = searchResults.slice(0, 15).join("\n\n---\n\n");
  const contextBlock = approvedContext ? `\n\n${approvedContext}` : "";

  const perMarketSample = brief.markets
    .map((m) => {
      const c = resolveMarket(m);
      return `{"market":"${m}","currency":"${c.code}","symbol":"${c.symbol}","low":<number>,"mid":<number>,"high":<number>,"reasoning":"local pricing rationale"}`;
    })
    .join(",\n    ");

  const prompt = `You are a market research analyst.

${briefHeader(brief)}

WEB RESEARCH DATA:
${searchContext || "No web data available — rely on your knowledge."}
${contextBlock}

Return ONLY valid JSON (no markdown fences):
{
  "marketAnalysis": "2-3 paragraph market overview with size, growth, key players. Mention each of the target markets specifically.",
  "competitiveLandscape": [
    {"name":"...","url":"https://...","priceRange":"...","positioning":"...","strengths":["...","..."]}
  ],
  "trends": ["trend 1", "trend 2", "trend 3", "trend 4", "trend 5"],
  "targetAudienceProfile": {
    "demographics": "...",
    "preferences": ["...", "..."],
    "shoppingBehavior": "..."
  },
  "pricingStrategy": [
    ${perMarketSample}
  ],
  "productRecommendations": [
    {"category":"...","estimatedDemand":"high|medium|low","suggestedCount":<number>}
  ]
}

Rules:
- competitiveLandscape: 5-8 entries, include local-vs-global players per market when relevant.
- pricingStrategy: exactly one entry per target market, with realistic local-currency numbers calibrated to the "${brief.marketSegment}" segment.
- productRecommendations: one entry per product in ${brief.products.join(", ")}.`;

  const raw = await aiSynthesize(prompt);
  const jsonStr = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();

  let parsed: {
    marketAnalysis: string;
    competitiveLandscape: Competitor[];
    trends: string[];
    targetAudienceProfile: AudienceProfile;
    pricingStrategy: MarketPricingTier[];
    productRecommendations: ProductRecommendation[];
  };
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error("Failed to parse research output");
  }

  const sections: ResearchSections = {
    marketAnalysis:         freshSection("marketAnalysis", parsed.marketAnalysis),
    competitiveLandscape:   freshSection("competitiveLandscape", parsed.competitiveLandscape),
    trends:                 freshSection("trends", parsed.trends),
    targetAudienceProfile:  freshSection("targetAudienceProfile", parsed.targetAudienceProfile),
    pricingStrategy:        freshSection("pricingStrategy", parsed.pricingStrategy),
    productRecommendations: freshSection("productRecommendations", parsed.productRecommendations),
  };

  return { ...parsed, sections };
}
