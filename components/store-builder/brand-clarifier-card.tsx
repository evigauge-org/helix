// components/store-builder/brand-clarifier-card.tsx
"use client";

import { useState, useEffect } from "react";
import { Store, Loader2, Sparkles, X } from "lucide-react";
import type { StoreBrief, BrandCategory, MarketCode, MarketSegment } from "@/lib/store-builder/types";
import { MARKET_CURRENCY } from "@/lib/store-builder/markets";

interface Props {
  initialCategory?: BrandCategory;
  initialCustomType?: string;
  onSubmit: (brief: StoreBrief) => void;
  loading?: boolean;
}

interface CategorySchema {
  niche: { label: string; options: string[] };
  products: { label: string; options: string[] };
}

const CATEGORY_SCHEMAS: Record<Exclude<BrandCategory, "other">, CategorySchema> = {
  clothing: {
    niche:    { label: "Style / niche",    options: ["Streetwear", "Luxury", "Athleisure", "Casual", "Formal", "Sustainable", "Kids", "Plus-size"] },
    products: { label: "Products you'll sell", options: ["T-shirts", "Hoodies", "Jeans", "Dresses", "Jackets", "Shoes", "Accessories", "Bags", "Activewear"] },
  },
  electronics: {
    niche:    { label: "Electronics category", options: ["Consumer gadgets", "Smart home", "Audio/headphones", "Wearables", "Gaming", "PC components", "Mobile accessories", "Photography"] },
    products: { label: "Products you'll sell", options: ["Headphones", "Speakers", "Cables", "Chargers", "Smart bulbs", "Fitness trackers", "Cameras", "Keyboards", "Mice"] },
  },
  digital: {
    niche:    { label: "Digital product type", options: ["SaaS", "Info products", "Online courses", "Templates/themes", "Stock media", "Plugins/apps", "Digital art", "Newsletters"] },
    products: { label: "Pricing model",       options: ["Monthly subscription", "One-time purchase", "Tiered pricing", "Freemium", "Pay-what-you-want"] },
  },
};

const MARKET_OPTIONS: { code: MarketCode; label: string }[] = [
  { code: "us", label: "US" }, { code: "uk", label: "UK" }, { code: "eu", label: "EU" },
  { code: "in", label: "India" }, { code: "ae", label: "UAE" }, { code: "au", label: "Australia" },
  { code: "ca", label: "Canada" }, { code: "jp", label: "Japan" }, { code: "sg", label: "Singapore" },
  { code: "global", label: "Global" },
];

const SEGMENT_OPTIONS: { value: MarketSegment; label: string; desc: string }[] = [
  { value: "budget",  label: "Budget",  desc: "mass-market, price-first" },
  { value: "mid",     label: "Mid-tier", desc: "balanced value" },
  { value: "premium", label: "Premium", desc: "quality-first" },
  { value: "luxury",  label: "Luxury",  desc: "exclusivity-first" },
];

const SCALE_OPTIONS: { value: StoreBrief["scale"]; label: string; desc: string }[] = [
  { value: "starter", label: "Starter", desc: "20–50 products" },
  { value: "growth",  label: "Growth",  desc: "50–150 products" },
  { value: "premium", label: "Premium", desc: "150+ products" },
];

function Pill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
        selected
          ? "bg-[#0085CF] text-white shadow-sm"
          : "bg-gray-100 text-gray-700 hover:bg-[#0085CF]/10 hover:text-[#0085CF]"
      }`}
    >
      {label}
    </button>
  );
}

function CustomPillAdder({ onAdd }: { onAdd: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  const submit = () => {
    const v = value.trim();
    if (v.length === 0) return;
    onAdd(v);
    setValue("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border border-dashed border-gray-300 px-3.5 py-1.5 text-sm font-medium text-gray-500 hover:border-[#0085CF] hover:text-[#0085CF] transition-colors cursor-pointer"
      >
        + Add custom
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white border border-[#0085CF] px-2 py-0.5">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setOpen(false); }}
        placeholder="type + Enter"
        className="w-32 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 outline-none px-2 py-0.5"
      />
      <button onClick={submit} className="text-xs text-[#0085CF] font-semibold cursor-pointer">add</button>
      <button onClick={() => setOpen(false)} className="text-gray-400 cursor-pointer" aria-label="cancel">
        <X className="size-3" />
      </button>
    </span>
  );
}

export function BrandClarifierCard({ initialCategory = "clothing", initialCustomType, onSubmit, loading }: Props) {
  const [category, setCategory] = useState<BrandCategory>(initialCategory);
  const [customType, setCustomType] = useState(initialCustomType ?? "");
  const [customSchema, setCustomSchema] = useState<{
    nichePills: { label: string; options: string[] };
    productPills: { label: string; options: string[] };
  } | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const [markets, setMarkets] = useState<MarketCode[]>(["us"]);
  const [segment, setSegment] = useState<MarketSegment>("mid");
  const [scale, setScale] = useState<StoreBrief["scale"]>("growth");

  const [nicheOptions, setNicheOptions] = useState<string[]>([]);
  const [productOptions, setProductOptions] = useState<string[]>([]);

  const [niche, setNiche] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [audience, setAudience] = useState("");
  const [freeform, setFreeform] = useState("");

  useEffect(() => {
    if (category === "other" && customSchema) {
      setNicheOptions(customSchema.nichePills.options);
      setProductOptions(customSchema.productPills.options);
    } else if (category !== "other") {
      setNicheOptions(CATEGORY_SCHEMAS[category].niche.options);
      setProductOptions(CATEGORY_SCHEMAS[category].products.options);
    } else {
      setNicheOptions([]);
      setProductOptions([]);
    }
    setNiche([]);
    setProducts([]);
  }, [category, customSchema]);

  useEffect(() => {
    if (category !== "other" || !customType.trim() || customType.length < 3) return;
    setSchemaLoading(true);
    setSchemaError(null);
    fetch("/api/store-builder/clarifier-schema", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customType: customType.trim() }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setSchemaError(typeof d.error === "string" ? d.error : "Schema generation failed");
          setCustomSchema(null);
        } else {
          setCustomSchema(d);
          setSchemaError(null);
        }
      })
      .catch(() => setSchemaError("Schema generation failed"))
      .finally(() => setSchemaLoading(false));
  }, [category, customType]);

  const toggleMarket = (code: MarketCode) =>
    setMarkets((prev) => (prev.includes(code) ? prev.filter((m) => m !== code) : [...prev, code]));
  const toggleNiche = (v: string) =>
    setNiche((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  const toggleProduct = (v: string) =>
    setProducts((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const canSubmit =
    markets.length > 0 &&
    niche.length > 0 &&
    products.length > 0 &&
    audience.trim().length > 0 &&
    (category !== "other" || (customType.trim().length >= 3 && !!customSchema));

  const handleSubmit = () => {
    onSubmit({
      brandCategory: category,
      brandCategoryCustom: category === "other" ? customType.trim() : undefined,
      markets,
      marketSegment: segment,
      niche,
      products,
      audience: audience.trim(),
      scale,
      freeformNote: freeform.trim() || undefined,
      customClarifierSchema:
        category === "other" && customSchema
          ? customSchema
          : undefined,
    });
  };

  return (
    <div className="my-4 rounded-xl border border-[#0085CF]/15 bg-white p-5 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0085CF] to-[#003754] shadow-md">
          <Store className="size-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-800">Brand Builder</p>
          <p className="text-xs text-gray-500">Tell me about your brand — I&apos;ll build the rest.</p>
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">What kind of brand?</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as BrandCategory)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0085CF]/30"
        >
          <option value="clothing">Clothing / Fashion</option>
          <option value="electronics">Electronics</option>
          <option value="digital">Digital products</option>
          <option value="other">Other (custom)</option>
        </select>
        {category === "other" && (
          <input
            value={customType}
            onChange={(e) => setCustomType(e.target.value)}
            placeholder="e.g. pet accessories, musical instruments, home decor"
            className="w-full mt-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0085CF]/30"
          />
        )}
        {schemaLoading && (
          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
            <Loader2 className="size-3 animate-spin" /> Generating fields for your brand…
          </p>
        )}
        {schemaError && (
          <p className="text-xs text-red-600 mt-2">{schemaError}</p>
        )}
      </div>

      {/* Markets */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Target markets (multi-select)</label>
        <div className="flex flex-wrap gap-2">
          {MARKET_OPTIONS.map((m) => (
            <Pill
              key={m.code}
              label={`${m.label} (${MARKET_CURRENCY[m.code].code})`}
              selected={markets.includes(m.code)}
              onClick={() => toggleMarket(m.code)}
            />
          ))}
        </div>
      </div>

      {/* Segment */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Market segment</label>
        <div className="flex flex-wrap gap-2">
          {SEGMENT_OPTIONS.map((s) => (
            <Pill key={s.value} label={`${s.label} — ${s.desc}`} selected={segment === s.value} onClick={() => setSegment(s.value)} />
          ))}
        </div>
      </div>

      {/* Scale */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Catalog size to start with</label>
        <div className="flex flex-wrap gap-2">
          {SCALE_OPTIONS.map((s) => (
            <Pill key={s.value} label={`${s.label} — ${s.desc}`} selected={scale === s.value} onClick={() => setScale(s.value)} />
          ))}
        </div>
      </div>

      {/* Niche pills */}
      {nicheOptions.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Niche</label>
          <div className="flex flex-wrap gap-2">
            {nicheOptions.map((opt) => (
              <Pill key={opt} label={opt} selected={niche.includes(opt)} onClick={() => toggleNiche(opt)} />
            ))}
            <CustomPillAdder onAdd={(v) => {
              if (!nicheOptions.includes(v)) setNicheOptions((prev) => [...prev, v]);
              setNiche((prev) => (prev.includes(v) ? prev : [...prev, v]));
            }} />
          </div>
        </div>
      )}

      {/* Products pills */}
      {productOptions.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Products</label>
          <div className="flex flex-wrap gap-2">
            {productOptions.map((opt) => (
              <Pill key={opt} label={opt} selected={products.includes(opt)} onClick={() => toggleProduct(opt)} />
            ))}
            <CustomPillAdder onAdd={(v) => {
              if (!productOptions.includes(v)) setProductOptions((prev) => [...prev, v]);
              setProducts((prev) => (prev.includes(v) ? prev : [...prev, v]));
            }} />
          </div>
        </div>
      )}

      {/* Audience */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Target audience</label>
        <input
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          placeholder="e.g. Gen Z urban males, fitness-conscious"
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0085CF]/30"
        />
      </div>

      {/* Freeform */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Anything else? (optional)</label>
        <textarea
          value={freeform}
          onChange={(e) => setFreeform(e.target.value)}
          rows={2}
          placeholder="Any additional context..."
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0085CF]/30 resize-none"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || !canSubmit}
        className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#0085CF] to-[#003754] px-4 py-2.5 text-sm font-medium text-white hover:from-[#006BA6] hover:to-[#003754] disabled:opacity-40 transition-all cursor-pointer shadow-sm"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        Start Building
      </button>
    </div>
  );
}
