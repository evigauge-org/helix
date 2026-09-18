// lib/store-builder/catalog.ts
import * as XLSX from "xlsx";
import { randomUUID } from "crypto";
import type {
  StoreBrief, ResearchOutput, CatalogOutput, CatalogProduct, CatalogSections,
  EditableSection, SectionVersion,
} from "./types";
import { MARKET_SEGMENT_DESCRIPTIONS, resolveMarket } from "./markets";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

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
      max_tokens: 8192,
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter error ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function freshSection<T>(id: string, content: T): EditableSection<T> {
  const versionId = randomUUID();
  const version: SectionVersion<T> = { id: versionId, content, author: "ai", createdAt: new Date().toISOString() };
  return { id, versions: [version], activeVersionId: versionId };
}

function variantOptionsForCategory(brief: StoreBrief): string {
  switch (brief.brandCategory) {
    case "clothing":    return `Variants: 2-3 color options × 3-5 sizes (XS/S/M/L/XL). option1=color, option2=size.`;
    case "electronics": return `Variants: 1-3 model/capacity variations (e.g. 64GB/128GB/256GB, or Black/Silver). option1=model, option2 optional.`;
    case "digital":     return `Variants: 1-3 pricing tiers (e.g. Basic/Pro/Enterprise or Monthly/Annual/Lifetime). option1=tier, option2 optional.`;
    case "other":
    default:            return `Variants: 2-3 meaningful variations appropriate to the product type. option1=variant name, option2 optional.`;
  }
}

function skuPrefixForCategory(brief: StoreBrief): string {
  const prefix = brief.niche[0]?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase() ?? "ITEM";
  return prefix;
}

export async function generateCatalog(brief: StoreBrief, research: ResearchOutput, approvedContext?: string): Promise<CatalogOutput> {
  const brandName = "MyBrand";
  const targetCount = brief.scale === "starter" ? 35 : brief.scale === "growth" ? 100 : 150;
  const contextBlock = approvedContext ? `\n\n${approvedContext}` : "";
  const recsContext = research.productRecommendations
    .map((r) => `${r.category}: ${r.suggestedCount} items, demand=${r.estimatedDemand}`)
    .join("\n");

  const primaryMarket = brief.markets[0] ?? "us";
  const primaryCurrency = resolveMarket(primaryMarket);
  const primaryPricing = research.pricingStrategy.find((p) => p.market === primaryMarket) ?? research.pricingStrategy[0];

  const perMarketPricingBlock = research.pricingStrategy
    .map((p) => `- ${p.market} (${p.currency}${p.symbol}): low ${p.symbol}${p.low}, mid ${p.symbol}${p.mid}, high ${p.symbol}${p.high}`)
    .join("\n");

  const prompt = `You are an ecommerce catalog specialist. Generate a Shopify-ready product catalog.

BRAND BRIEF:
- Category: ${brief.brandCategory}${brief.brandCategoryCustom ? ` (${brief.brandCategoryCustom})` : ""}
- Niche: ${brief.niche.join(", ")}
- Products: ${brief.products.join(", ")}
- Audience: ${brief.audience}
- Market segment: ${brief.marketSegment} (${MARKET_SEGMENT_DESCRIPTIONS[brief.marketSegment]})
- Primary market: ${primaryMarket} (${primaryCurrency.code} ${primaryCurrency.symbol})
- All markets: ${brief.markets.join(", ")}

MARKET RESEARCH PRICING (per market):
${perMarketPricingBlock}

PRODUCT MIX RECOMMENDATIONS:
${recsContext}

${variantOptionsForCategory(brief)}
${contextBlock}

Generate approximately ${targetCount} products. Return ONLY valid JSON array (no markdown):
[
  {
    "handle": "${skuPrefixForCategory(brief).toLowerCase()}-example-01",
    "title": "Example Product",
    "bodyHtml": "<p>Compelling product description...</p>",
    "vendor": "${brandName}",
    "productType": "Example",
    "tags": "tag1, tag2",
    "variants": [
      {"sku":"${skuPrefixForCategory(brief)}-001-A","price":"${primaryPricing?.mid ?? 49}","compareAtPrice":"${(primaryPricing?.mid ?? 49) * 1.25}","cost":"${Math.round((primaryPricing?.mid ?? 49) * 0.35)}","weight":0.3,"option1":"Black","option2":"M","pricesByMarket":{${research.pricingStrategy
      .map((p) => `"${p.market}":{"price":"${p.mid}","compareAtPrice":"${Math.round(p.mid * 1.25)}","currency":"${p.currency}"}`)
      .join(",")}}}
    ],
    "images": [],
    "seoTitle": "Example Product | ${brandName}",
    "seoDescription": "SEO description..."
  }
]

Rules:
- price and compareAtPrice at top-level use the PRIMARY market (${primaryMarket}, ${primaryCurrency.code}).
- pricesByMarket must include an entry for EVERY market in the research pricingStrategy.
- compareAtPrice 20-25% higher than price; cost 30-40% of price.
- Each variant SKU: ${skuPrefixForCategory(brief)}-NNN-SUFFIX.
- Cover ALL categories: ${brief.products.join(", ")}.
- Generate ${targetCount} products minimum.`;

  const raw = await aiGenerate(prompt);
  const jsonStr = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  let products: CatalogProduct[];
  try {
    products = JSON.parse(jsonStr);
  } catch {
    throw new Error("Failed to parse catalog output");
  }

  const totalVariants = products.reduce((sum, p) => sum + p.variants.length, 0);
  const allPrices = products.flatMap((p) => p.variants.map((v) => parseFloat(v.price)));
  const avgPrice = allPrices.length > 0 ? Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length) : 0;
  const catalogValue = Math.round(allPrices.reduce((a, b) => a + b, 0));

  const sections: CatalogSections = { products: freshSection("products", products) };

  return {
    products,
    xlsxDownloadUrl: "",
    stats: { totalProducts: products.length, totalVariants, avgPrice, catalogValue },
    sections,
  };
}

export function buildCatalogXlsx(products: CatalogProduct[]): Buffer {
  const rows: Record<string, string | number>[] = [];
  for (const product of products) {
    for (let vi = 0; vi < product.variants.length; vi++) {
      const v = product.variants[vi];
      rows.push({
        Handle: product.handle,
        Title: vi === 0 ? product.title : "",
        "Body (HTML)": vi === 0 ? product.bodyHtml : "",
        Vendor: vi === 0 ? product.vendor : "",
        Type: vi === 0 ? product.productType : "",
        Tags: vi === 0 ? product.tags : "",
        Published: vi === 0 ? "TRUE" : "",
        "Option1 Name": vi === 0 ? "Color" : "",
        "Option1 Value": v.option1,
        "Option2 Name": vi === 0 ? "Size" : "",
        "Option2 Value": v.option2 ?? "",
        "Variant SKU": v.sku,
        "Variant Price": v.price,
        "Variant Compare At Price": v.compareAtPrice,
        "Variant Cost": v.cost,
        "Variant Weight": v.weight,
        "Variant Weight Unit": "kg",
        "Image Src": vi === 0 && product.images.length > 0 ? product.images[0] : "",
        "SEO Title": vi === 0 ? product.seoTitle : "",
        "SEO Description": vi === 0 ? product.seoDescription : "",
      });
    }
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Products");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
