// Detects multiple intents from a single user query
// e.g. "Research AI in healthcare, create a presentation, and make an Instagram carousel"

import type { BrandCategory } from "@/lib/store-builder/types";

export type Intent = "presentation" | "carousel" | "gamma" | "research" | "store_builder" | "sheet" | "recruitment" | "conversation";

// Routing for the presentation intent
export type PresentationTarget = "canva";

interface DetectedIntents {
  intents: Intent[];
  topics: Record<Intent, string>;
  presentationTarget: PresentationTarget; // always: "canva"
}

const PRESENTATION_TRIGGERS = [
  "slide deck", "slides", "presentation", "ppt", "powerpoint", "deck",
  "pitch deck", "brief deck", "slidedeck",
];
const CAROUSEL_TRIGGERS = ["carousel", "instagram carousel", "instagram post", "insta carousel", "ig carousel"];
const RESEARCH_TRIGGERS = ["research", "analyze", "deep analysis", "compare", "investigate", "due diligence"];

// Store-builder triggers — regex-based so natural variants like
// "build me a store for my electronics watch brand" still match even when
// the exact substring "build a store" doesn't appear verbatim.
const STORE_BUILDER_PATTERNS: RegExp[] = [
  // build/make/create/launch/start/open [me] [a|an|my|new|own] [online/shopify/e-commerce] store/shop/brand
  /\b(build|make|create|launch|start|open|set ?up|setup)\s+(me\s+)?(a\s+|an\s+|my\s+|new\s+|own\s+)*(online\s+|shopify\s+|e-?commerce\s+)*(store|shop|brand|e-?commerce|shopify|storefront|website)\b/i,
  // "I want/need/wanna [to] build/create/...""
  /\bi\s+(want|need|wanna|would like|'d like|'m looking)\s+to\s+(build|make|create|launch|start|open|set ?up|setup)\s+(me\s+)?(a\s+|an\s+|my\s+|new\s+|own\s+)*(online\s+|shopify\s+|e-?commerce\s+)*(store|shop|brand|business|storefront)\b/i,
  // "<category> brand/store/line/shop" — broad category list covers most asks
  /\b(clothing|apparel|fashion|streetwear|athleisure|denim|electronics|consumer\s+electronics|gadget|smart\s?home|watch(?:es)?|digital|saas|info|course|fitness|wellness|beauty|skin(?:care)?|cosmetic|jewel(?:ry|lery)|pet|home(?:\s?goods)?|decor|food|beverage|drinks|wine|tea|coffee|spirits|audio|tech|gaming|book|toy|toys|baby|kids?|bridal|grooming|vape|candle|furniture|handbag|accessor(?:y|ies)|sport|outdoor|running|yoga|wellness)\s+(brand|store|line|shop|boutique|label|business|company)\b/i,
  // Standalone ecommerce nouns
  /\b(estore|e-store|e-?commerce\s+store|online\s+store|shopify\s+store|dropship(?:ping)?\s+store)\b/i,
  // "my [own] [X] brand" — generic catch-all when user says "my watch brand"
  /\bmy\s+(own\s+|new\s+)*\w+?\s+brand\b/i,
  // Short/explicit commands
  /\b(clothing line|fashion line|product line|ecommerce business|online business)\b/i,
];

function matchesStoreBuilder(query: string): boolean {
  return STORE_BUILDER_PATTERNS.some((re) => re.test(query));
}

// Gamma-specific triggers
const GAMMA_TRIGGERS = [
  "gamma", "in gamma", "via gamma", "using gamma", "on gamma",
  "gamma ai", "with gamma", "create in gamma", "generate in gamma",
];

// Sheets-specific triggers — produces a Google Sheet artifact from prior content
const SHEET_TRIGGERS = [
  "put this in a sheet", "put it in a sheet", "put it in a spreadsheet",
  "put that in a sheet", "put these in a sheet", "put those in a sheet",
  "make a sheet", "create a sheet", "build a sheet", "generate a sheet",
  "make a spreadsheet", "create a spreadsheet", "build a spreadsheet",
  "make it a sheet", "turn this into a sheet", "turn it into a sheet",
  "turn that into a sheet", "export to sheets", "export to google sheets",
  "google sheet", "google spreadsheet", "in a google sheet",
  "tabulate this", "tabulate it", "as a table in sheets",
];

// Recruitment / sourcing — natural variants covering "find/source/hire/recruit"
// plus "candidates/profiles/people" plus common target roles.
const RECRUITMENT_PATTERNS: RegExp[] = [
  /\b(source|find|hire|recruit|look\s+for|search\s+for)\s+(\d+\s+)?(a\s+)?(senior\s+|junior\s+|mid(?:-|\s+)level\s+|top\s+)?(candidates?|profiles?|people|lawyers?|attorneys?|engineers?|developers?|doctors?|designers?|analysts?|consultants?|associates?|partners?|directors?|managers?|executives?)/i,
  /\bi\s+(want|need|wanna|would\s+like|'d\s+like|'m\s+looking)\s+to\s+(source|find|hire|recruit)\b/i,
  /\b(sourcing|recruitment|talent\s+search|candidate\s+search)\s+(for|of)\b/i,
];

function matchesRecruitment(query: string): boolean {
  return RECRUITMENT_PATTERNS.some((re) => re.test(query));
}

export function detectIntents(query: string): DetectedIntents {
  const lower = query.toLowerCase();
  const intents: Intent[] = [];
  const topics: Record<string, string> = {};

  // Extract the core topic by stripping intent markers
  let coreTopic = query;
  for (const strip of [
    "create a slide deck about", "make a presentation about", "create slides about",
    "create a presentation on", "make slides on", "create an instagram carousel about",
    "make a carousel about", "create carousel about", "research", "analyze",
    "run deep analysis on", "and also", "and create", "and make",
    "give it to me in my canva", "open in canva", "in my canva", "to canva", "in canva",
    "open the deck in canva", "via canva", "using canva", "on canva",
    "create a pitch deck about", "make a pitch deck about", "create a brief deck about",
    "in gamma", "via gamma", "using gamma", "on gamma", "with gamma",
    "create in gamma", "generate in gamma", "gamma ai",
    "open a brand", "start a brand", "clothing brand", "estore", "ecommerce store",
    "shopify store", "online store", "build a store", "launch a brand", "clothing line",
  ]) {
    coreTopic = coreTopic.replace(new RegExp(strip, "gi"), "").trim();
  }
  coreTopic = coreTopic.replace(/^[,\s]+|[,\s]+$/g, "").replace(/\s{2,}/g, " ").trim();
  if (!coreTopic) coreTopic = query;

  // Check presentation
  if (PRESENTATION_TRIGGERS.some((t) => lower.includes(t))) {
    intents.push("presentation");
    topics.presentation = coreTopic;
  }

  // Check carousel
  if (CAROUSEL_TRIGGERS.some((t) => lower.includes(t))) {
    intents.push("carousel");
    topics.carousel = coreTopic;
  }

  // Check Gamma
  if (GAMMA_TRIGGERS.some((t) => lower.includes(t))) {
    intents.push("gamma");
    topics.gamma = coreTopic;
  }

  // Check research
  if (RESEARCH_TRIGGERS.some((t) => lower.includes(t))) {
    intents.push("research");
    topics.research = coreTopic;
  }

  // Check store builder
  if (matchesStoreBuilder(query)) {
    intents.push("store_builder");
    topics.store_builder = coreTopic;
  }

  // Check sheet
  if (SHEET_TRIGGERS.some((t) => lower.includes(t))) {
    intents.push("sheet");
    topics.sheet = coreTopic;
  }

  // Check recruitment
  if (matchesRecruitment(query)) {
    intents.push("recruitment");
    topics.recruitment = query; // keep the raw query — brief API re-parses it
  }

  // Default to conversation if nothing specific detected
  if (intents.length === 0) {
    intents.push("conversation");
    topics.conversation = query;
  }

  // Presentations always render via Canva.
  const presentationTarget: PresentationTarget = "canva";

  return {
    intents,
    topics: topics as Record<Intent, string>,
    presentationTarget,
  };
}

// ───────── Store-builder sub-intent classifier ─────────

export type StoreBuilderSubIntent = "specific-category" | "vague-brand-intent" | "none";

export interface StoreBuilderIntent {
  subIntent: StoreBuilderSubIntent;
  category: BrandCategory | null;
  freeText: string;
}

// Phrases that signal the user wants to build a brand/store but hasn't named a category.
const VAGUE_BRAND_TRIGGERS = [
  "build a brand", "start a brand", "start a store", "build a store",
  "open a store", "launch a brand", "launch a store", "help me with a brand",
  "help me build a brand", "i want to start a business", "ecommerce business",
  "online business", "create a brand",
];

// Category keyword maps — ordered most-specific first.
// Multi-word phrases come first so they win over bare-word fallbacks.
const CATEGORY_KEYWORDS: { keyword: string; category: BrandCategory }[] = [
  // Clothing — multi-word first
  { keyword: "clothing brand",   category: "clothing" },
  { keyword: "clothing line",    category: "clothing" },
  { keyword: "clothing store",   category: "clothing" },
  { keyword: "fashion brand",    category: "clothing" },
  { keyword: "fashion line",     category: "clothing" },
  { keyword: "apparel",          category: "clothing" },
  { keyword: "streetwear",       category: "clothing" },
  { keyword: "athleisure",       category: "clothing" },
  { keyword: "denim",            category: "clothing" },
  { keyword: "clothing",         category: "clothing" },
  { keyword: "fashion",          category: "clothing" },

  // Electronics — multi-word first; bare "electronics" catches "electronics watch brand"
  { keyword: "consumer electronics", category: "electronics" },
  { keyword: "electronics brand",    category: "electronics" },
  { keyword: "electronics store",    category: "electronics" },
  { keyword: "gadget brand",         category: "electronics" },
  { keyword: "smart home brand",     category: "electronics" },
  { keyword: "smart home",           category: "electronics" },
  { keyword: "electronics",          category: "electronics" },
  { keyword: "gadget",               category: "electronics" },
  { keyword: "smartwatch",           category: "electronics" },
  { keyword: "wearable",             category: "electronics" },
  { keyword: "watches",              category: "electronics" },
  { keyword: "watch brand",          category: "electronics" },

  // Digital — multi-word first
  { keyword: "digital products",     category: "digital" },
  { keyword: "digital brand",        category: "digital" },
  { keyword: "saas brand",           category: "digital" },
  { keyword: "info products",        category: "digital" },
  { keyword: "online course brand",  category: "digital" },
  { keyword: "saas",                 category: "digital" },
  { keyword: "info product",         category: "digital" },
];

const OTHER_NOUN_HINTS = [
  " brand", " line", " store", " company", " label", " boutique",
];

export function detectStoreBuilderIntent(query: string): StoreBuilderIntent {
  const lower = query.toLowerCase();

  // 1. Try specific-category match first.
  for (const { keyword, category } of CATEGORY_KEYWORDS) {
    if (lower.includes(keyword)) {
      return { subIntent: "specific-category", category, freeText: query };
    }
  }

  // 2. Vague intent?
  if (VAGUE_BRAND_TRIGGERS.some((t) => lower.includes(t))) {
    return { subIntent: "vague-brand-intent", category: null, freeText: query };
  }

  // 3. "Specific custom" — mentions "<something> brand" or similar noun hints.
  //    Only qualifies as store-builder if it also contains build/start/launch/open.
  const hasBuildVerb = ["build", "start", "launch", "open", "create"].some((v) => lower.includes(v));
  const hasNounHint = OTHER_NOUN_HINTS.some((n) => lower.includes(n));
  if (hasBuildVerb && hasNounHint) {
    return { subIntent: "specific-category", category: "other", freeText: query };
  }

  return { subIntent: "none", category: null, freeText: query };
}
