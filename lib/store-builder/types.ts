// lib/store-builder/types.ts

export type BrandCategory = "clothing" | "electronics" | "digital" | "other";

export type MarketCode =
  | "us" | "uk" | "eu" | "in" | "ae" | "au" | "ca" | "jp" | "sg" | "global"
  | string; // free-text for "Other" markets

export type MarketSegment = "budget" | "mid" | "premium" | "luxury";

export interface StoreBrief {
  brandCategory: BrandCategory;
  brandCategoryCustom?: string;
  markets: MarketCode[];
  marketSegment: MarketSegment;
  niche: string[];
  products: string[];
  audience: string;
  scale: "starter" | "growth" | "premium";
  freeformNote?: string;
  customClarifierSchema?: {
    nichePills: { label: string; options: string[] };
    productPills: { label: string; options: string[] };
  };
}

export type StageStatus = "pending" | "running" | "awaiting_approval" | "approved" | "rejected" | "editing" | "completed" | "failed";
export type ProjectStatus = "wizard" | "researching" | "catalog" | "branding" | "social" | "shopify" | "completed" | "failed";
export type StageName = "research" | "catalog" | "branding" | "social" | "shopify";

export const STAGE_ORDER: { stage: number; name: StageName; label: string }[] = [
  { stage: 1, name: "research", label: "Market Research" },
  { stage: 2, name: "catalog",  label: "Product Catalog" },
  { stage: 3, name: "branding", label: "Brand Identity" },
  { stage: 4, name: "social",   label: "Social Templates" },
  { stage: 5, name: "shopify",  label: "Shopify Store" },
];

// ───────── Editable section primitive ─────────

export interface SectionVersion<T> {
  id: string;
  content: T;
  author: "ai" | "user";
  createdAt: string;
  regenerationPrompt?: string;
}

export interface EditableSection<T> {
  id: string;
  versions: SectionVersion<T>[];
  activeVersionId: string;
  approvedVersionId?: string;
}

// ───────── Market pricing ─────────

export interface MarketPricingTier {
  market: MarketCode;
  currency: string;
  symbol: string;
  low: number;
  mid: number;
  high: number;
  reasoning: string;
}

// ───────── Research output ─────────

export interface Competitor {
  name: string;
  url: string;
  priceRange: string;
  positioning: string;
  strengths: string[];
}

export interface AudienceProfile {
  demographics: string;
  preferences: string[];
  shoppingBehavior: string;
}

export interface ProductRecommendation {
  category: string;
  estimatedDemand: string;
  suggestedCount: number;
}

export interface ResearchSections {
  marketAnalysis:         EditableSection<string>;
  competitiveLandscape:   EditableSection<Competitor[]>;
  trends:                 EditableSection<string[]>;
  targetAudienceProfile:  EditableSection<AudienceProfile>;
  pricingStrategy:        EditableSection<MarketPricingTier[]>;
  productRecommendations: EditableSection<ProductRecommendation[]>;
}

export interface ResearchOutput {
  marketAnalysis: string;
  competitiveLandscape: Competitor[];
  trends: string[];
  targetAudienceProfile: AudienceProfile;
  pricingStrategy: MarketPricingTier[];
  productRecommendations: ProductRecommendation[];
  sections: ResearchSections;
}

// ───────── Catalog output ─────────

export interface ProductVariant {
  sku: string;
  price: string;
  compareAtPrice: string;
  cost: string;
  weight: number;
  option1: string;
  option2?: string;
  pricesByMarket?: Record<string, { price: string; compareAtPrice: string; currency: string }>;
}

export interface CatalogProduct {
  handle: string;
  title: string;
  bodyHtml: string;
  vendor: string;
  productType: string;
  tags: string;
  variants: ProductVariant[];
  images: string[];
  seoTitle: string;
  seoDescription: string;
}

export interface CatalogSections {
  products: EditableSection<CatalogProduct[]>;
}

export interface CatalogOutput {
  products: CatalogProduct[];
  xlsxDownloadUrl: string;
  stats: { totalProducts: number; totalVariants: number; avgPrice: number; catalogValue: number };
  sections: CatalogSections;
}

// ───────── Branding output ─────────

export interface BrandNameOption {
  name: string;
  tagline: string;
  domainAvailable: boolean;
  reasoning: string;
}

export interface BrandVoice {
  tone: string;
  dos: string[];
  donts: string[];
  sampleProductDesc: string;
  sampleCaption: string;
}

export interface BrandingSections {
  nameOptions:    EditableSection<BrandNameOption[]>;
  colors:         EditableSection<{ primary: string; secondary: string; accent: string; neutral: string; background: string; text: string }>;
  typography:     EditableSection<{ heading: string; body: string; reasoning: string }>;
  brandVoice:     EditableSection<BrandVoice>;
}

export interface BrandingOutput {
  nameOptions: BrandNameOption[];
  selectedName: string;
  colors: { primary: string; secondary: string; accent: string; neutral: string; background: string; text: string };
  typography: { heading: string; body: string; reasoning: string };
  logoUrls: string[];
  selectedLogo: string;
  brandVoice: BrandVoice;
  brandKitUrl: string;
  sections: BrandingSections;
}

// ───────── Social output ─────────

export interface SuggestedCaption {
  text: string;
  hashtags: string[];
}

export interface SocialSections {
  captionTemplates: EditableSection<SuggestedCaption[]>;
  hashtagSet:       EditableSection<string[]>;
}

export interface SocialOutput {
  carouselHtml: string;
  coverImages: { instagram: string; facebook: string; shopifyHero: string };
  suggestedCaptions: SuggestedCaption[];
  hashtagSet: string[];
  assetsZipUrl: string;
  sections: SocialSections;
}

// ───────── Shopify output ─────────

export interface ShopifySections {
  launchChecklist: EditableSection<string[]>;
  themeNotes:      EditableSection<string>;
}

export interface ShopifyOutput {
  storeUrl: string;
  adminUrl: string;
  productsUploaded: number;
  collectionsCreated: string[];
  pagesCreated: string[];
  themeCustomized: boolean;
  launchChecklistUrl: string;
  launchChecklist: string[];
  themeNotes: string;
  sections: ShopifySections;
}

// ───────── API request/response types ─────────

export interface CreateProjectRequest {
  brief: StoreBrief;
}

export interface ApproveStageRequest {
  projectId: string;
  stage: number;
}

export interface EditStageRequest {
  projectId: string;
  stage: number;
  feedback: string;
}

export interface ProjectStatusResponse {
  id: string;
  status: ProjectStatus;
  currentStage: number;
  brief: StoreBrief;
  stages: { stage: number; name: StageName; status: StageStatus; output: unknown; error: string | null }[];
  shopifyStoreUrl: string | null;
}
