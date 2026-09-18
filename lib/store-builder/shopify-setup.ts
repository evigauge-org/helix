import { randomUUID } from "crypto";
import type {
  StoreBrief, CatalogOutput, BrandingOutput, SocialOutput, ShopifyOutput, ShopifySections,
  EditableSection, SectionVersion,
} from "./types";
import { isFirstClassMarket, resolveMarket } from "./markets";

function freshSection<T>(id: string, content: T): EditableSection<T> {
  const vid = randomUUID();
  const version: SectionVersion<T> = { id: vid, content, author: "ai", createdAt: new Date().toISOString() };
  return { id, versions: [version], activeVersionId: vid };
}

const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL; // e.g. "mystore.myshopify.com"

async function shopifyGraphQL(query: string, variables?: Record<string, unknown>): Promise<unknown> {
  if (!SHOPIFY_ACCESS_TOKEN || !SHOPIFY_STORE_URL) {
    throw new Error("Shopify not configured — set SHOPIFY_ACCESS_TOKEN and SHOPIFY_STORE_URL in .env");
  }

  const res = await fetch(`https://${SHOPIFY_STORE_URL}/admin/api/2024-10/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) throw new Error(`Shopify API error ${res.status}`);
  const data = await res.json();
  if (data.errors) throw new Error(JSON.stringify(data.errors));
  return data.data;
}

async function shopifyREST(endpoint: string, method: string, body?: unknown): Promise<unknown> {
  if (!SHOPIFY_ACCESS_TOKEN || !SHOPIFY_STORE_URL) {
    throw new Error("Shopify not configured");
  }

  const res = await fetch(`https://${SHOPIFY_STORE_URL}/admin/api/2024-10/${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) throw new Error(`Shopify REST error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function createProducts(catalog: CatalogOutput): Promise<number> {
  let count = 0;

  for (const product of catalog.products) {
    try {
      await shopifyREST("products.json", "POST", {
        product: {
          title: product.title,
          body_html: product.bodyHtml,
          vendor: product.vendor,
          product_type: product.productType,
          tags: product.tags,
          variants: product.variants.map((v) => ({
            option1: v.option1,
            option2: v.option2 ?? null,
            price: v.price,
            compare_at_price: v.compareAtPrice,
            sku: v.sku,
            weight: v.weight,
            weight_unit: "kg",
            inventory_management: "shopify",
          })),
          options: [
            { name: "Color" },
            ...(product.variants.some((v) => v.option2) ? [{ name: "Size" }] : []),
          ],
          images: product.images.map((src) => ({ src })),
          metafields_global_title_tag: product.seoTitle,
          metafields_global_description_tag: product.seoDescription,
        },
      });
      count++;
    } catch (err) {
      console.error(`Failed to create product ${product.title}:`, err);
    }

    // Rate limit: ~2 requests per second
    await new Promise((r) => setTimeout(r, 500));
  }

  return count;
}

async function createCollections(catalog: CatalogOutput): Promise<string[]> {
  const types = new Set(catalog.products.map((p) => p.productType));
  const created: string[] = [];

  for (const type of types) {
    try {
      await shopifyREST("smart_collections.json", "POST", {
        smart_collection: {
          title: type,
          rules: [{ column: "type", relation: "equals", condition: type }],
          published: true,
        },
      });
      created.push(type);
    } catch {
      // collection might already exist
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  // Add "New Arrivals" collection
  try {
    await shopifyREST("smart_collections.json", "POST", {
      smart_collection: {
        title: "New Arrivals",
        rules: [{ column: "created_at", relation: "greater_than", condition: "last_30_days" }],
        published: true,
        sort_order: "created-desc",
      },
    });
    created.push("New Arrivals");
  } catch { /* ignore */ }

  return created;
}

async function createPages(branding: BrandingOutput): Promise<string[]> {
  const pages = [
    {
      title: "About",
      body_html: `<h2>About ${branding.selectedName}</h2><p>${branding.brandVoice.sampleProductDesc}</p><p>We believe in quality, authenticity, and style. Our brand was built to fill a gap in the market — and we're just getting started.</p>`,
    },
    {
      title: "Contact",
      body_html: `<h2>Get in Touch</h2><p>Have questions? We'd love to hear from you.</p><p>Email: hello@${branding.selectedName.toLowerCase().replace(/\s/g, "")}.com</p>`,
    },
    {
      title: "Shipping Policy",
      body_html: `<h2>Shipping Policy</h2><p>We offer free shipping on orders over $50. Standard shipping takes 5-7 business days. Express shipping (2-3 days) is available at checkout for an additional fee.</p><p>International shipping is available to select countries.</p>`,
    },
    {
      title: "Return Policy",
      body_html: `<h2>Returns & Exchanges</h2><p>We accept returns within 30 days of purchase. Items must be unworn, unwashed, and in original condition with tags attached.</p><p>To start a return, email us at returns@${branding.selectedName.toLowerCase().replace(/\s/g, "")}.com</p>`,
    },
    {
      title: "Privacy Policy",
      body_html: `<h2>Privacy Policy</h2><p>${branding.selectedName} is committed to protecting your privacy. We collect only the information necessary to process your orders and improve your experience.</p>`,
    },
    {
      title: "Terms of Service",
      body_html: `<h2>Terms of Service</h2><p>By using our website, you agree to these terms. All products are subject to availability. Prices are subject to change without notice.</p>`,
    },
  ];

  const created: string[] = [];
  for (const page of pages) {
    try {
      await shopifyREST("pages.json", "POST", { page: { ...page, published: true } });
      created.push(page.title);
    } catch { /* ignore duplicates */ }
    await new Promise((r) => setTimeout(r, 300));
  }

  return created;
}

export async function runShopifySetup(
  brief: StoreBrief,
  catalog: CatalogOutput,
  branding: BrandingOutput,
  social: SocialOutput,
  approvedContext?: string,
): Promise<ShopifyOutput> {
  if (!SHOPIFY_ACCESS_TOKEN || !SHOPIFY_STORE_URL) {
    throw new Error("Shopify not configured — add SHOPIFY_ACCESS_TOKEN and SHOPIFY_STORE_URL to .env");
  }
  void social;
  void approvedContext;

  const productsUploaded = await createProducts(catalog);
  const collectionsCreated = await createCollections(catalog);
  const pagesCreated = await createPages(branding);

  const enabledMarkets: string[] = [];
  const skippedMarkets: string[] = [];
  for (const code of brief.markets) {
    if (!isFirstClassMarket(code)) {
      skippedMarkets.push(code);
      continue;
    }
    try {
      // TODO: wire to real Shopify Markets API — for now we record intent only.
      // await enableShopifyMarket({ market: code, currency: resolveMarket(code).code });
      enabledMarkets.push(code);
    } catch {
      skippedMarkets.push(code);
    }
  }

  const launchChecklist: string[] = [
    "Review generated product descriptions",
    "Upload high-resolution product photos",
    "Customize theme to match brand palette",
    "Connect payment gateway (Stripe/Shopify Payments)",
    "Configure shipping zones per enabled market",
    ...enabledMarkets.map((m) => `Markets: verify pricing rules for ${resolveMarket(m).name}`),
    ...skippedMarkets.map((m) => `TODO: enable market "${m}" manually (not a first-class market)`),
  ];
  const themeNotes = `Apply brand colors. Primary ${branding.colors.primary}, secondary ${branding.colors.secondary}.`;

  const sections: ShopifySections = {
    launchChecklist: freshSection("launchChecklist", launchChecklist),
    themeNotes:      freshSection("themeNotes", themeNotes),
  };

  return {
    storeUrl: `https://${SHOPIFY_STORE_URL}`,
    adminUrl: `https://${SHOPIFY_STORE_URL}/admin`,
    productsUploaded,
    collectionsCreated,
    pagesCreated,
    themeCustomized: false,
    launchChecklistUrl: "",
    launchChecklist,
    themeNotes,
    sections,
  };
}
