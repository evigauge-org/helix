"use client";

import { useState } from "react";
import { ShoppingBag, Download, Grid, List, Package, X } from "lucide-react";
import type { CatalogOutput, CatalogProduct } from "@/lib/store-builder/types";
import { EditableSection } from "./editable-section";
import { useSectionApi } from "./use-section-api";

interface Props {
  projectId: string;
  stageId: string;
  catalog: CatalogOutput;
  onSectionUpdated: (updated: CatalogOutput) => void;
}

function ProductGrid({ products }: { products: CatalogProduct[] }) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? products : products.slice(0, 12);

  const categories: Record<string, number> = {};
  for (const p of products) categories[p.productType] = (categories[p.productType] ?? 0) + 1;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(categories).map(([cat, count]) => (
          <span key={cat} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-700">{cat}: {count}</span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => setView("grid")} className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs cursor-pointer ${view === "grid" ? "bg-[#0085CF]/10 text-[#0085CF]" : "text-gray-500 hover:bg-gray-50"}`}>
          <Grid className="size-3" /> Grid
        </button>
        <button onClick={() => setView("list")} className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs cursor-pointer ${view === "list" ? "bg-[#0085CF]/10 text-[#0085CF]" : "text-gray-500 hover:bg-gray-50"}`}>
          <List className="size-3" /> List
        </button>
      </div>
      {view === "grid" ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {displayed.map((p, i) => (
            <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-2">
              <div className="flex size-12 items-center justify-center rounded-md bg-gray-200 mx-auto mb-1.5">
                <Package className="size-5 text-gray-400" />
              </div>
              <p className="text-[11px] font-medium text-gray-800 text-center truncate">{p.title}</p>
              <p className="text-[10px] text-[#0085CF] text-center">{p.variants[0]?.price ?? "—"}</p>
              <p className="text-[9px] text-gray-400 text-center">{p.variants.length} variants</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {displayed.map((p, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-2">
              <Package className="size-4 text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">{p.title}</p>
                <p className="text-[10px] text-gray-500">{p.productType} · {p.variants.length} variants · SKU: {p.variants[0]?.sku}</p>
              </div>
              <span className="text-xs font-medium text-[#0085CF] shrink-0">{p.variants[0]?.price}</span>
            </div>
          ))}
        </div>
      )}
      {products.length > 12 && (
        <button onClick={() => setShowAll(!showAll)} className="w-full text-center text-xs text-[#0085CF] hover:underline cursor-pointer py-1">
          {showAll ? "Show less" : `Show all ${products.length} products`}
        </button>
      )}
    </div>
  );
}

function ProductListEditor({ products, onChange }: { products: CatalogProduct[]; onChange: (p: CatalogProduct[]) => void }) {
  const patch = (i: number, p: Partial<CatalogProduct>) => {
    const next = [...products]; next[i] = { ...next[i], ...p }; onChange(next);
  };
  const patchVariantPrice = (i: number, price: string) => {
    const next = [...products]; const v = next[i].variants[0];
    if (v) { next[i] = { ...next[i], variants: [{ ...v, price }, ...next[i].variants.slice(1)] }; }
    onChange(next);
  };
  const remove = (i: number) => onChange(products.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
      {products.map((p, i) => (
        <div key={i} className="flex items-center gap-2 rounded border border-gray-200 bg-white p-1.5">
          <input value={p.title} onChange={(e) => patch(i, { title: e.target.value })} className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs" placeholder="Title" />
          <input value={p.variants[0]?.price ?? ""} onChange={(e) => patchVariantPrice(i, e.target.value)} className="w-20 rounded border border-gray-200 px-2 py-1 text-xs" placeholder="Price" />
          <button onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 cursor-pointer"><X className="size-3.5" /></button>
        </div>
      ))}
      <p className="text-[10px] text-gray-400">{products.length} products (scroll to see all)</p>
    </div>
  );
}

export function CatalogCard({ projectId, stageId, catalog, onSectionUpdated }: Props) {
  const api = useSectionApi<CatalogOutput>(projectId, stageId, 2, onSectionUpdated);

  return (
    <div className="my-4 rounded-xl border border-[#0085CF]/15 bg-white p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-100">
          <ShoppingBag className="size-5 text-emerald-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-800">Product Catalog</p>
          <p className="text-xs text-gray-500">{catalog.stats.totalProducts} products · {catalog.stats.totalVariants} variants</p>
        </div>
        <a href={`/api/store-builder/${projectId}/download?type=catalog`} download="product-catalog.xlsx" className="flex items-center gap-1.5 rounded-lg bg-[#0085CF] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#006BA6] transition-colors cursor-pointer">
          <Download className="size-3.5" /> XLSX
        </a>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-lg bg-[#0085CF]/5 border border-[#0085CF]/10 p-2 text-center">
          <div className="text-lg font-bold text-[#0085CF]">{catalog.stats.totalProducts}</div>
          <div className="text-[10px] text-gray-500">Products</div>
        </div>
        <div className="rounded-lg bg-[#0085CF]/5 border border-[#0085CF]/10 p-2 text-center">
          <div className="text-lg font-bold text-[#0085CF]">{catalog.stats.totalVariants}</div>
          <div className="text-[10px] text-gray-500">Variants</div>
        </div>
        <div className="rounded-lg bg-[#0085CF]/5 border border-[#0085CF]/10 p-2 text-center">
          <div className="text-lg font-bold text-[#0085CF]">${catalog.stats.avgPrice}</div>
          <div className="text-[10px] text-gray-500">Avg Price</div>
        </div>
        <div className="rounded-lg bg-[#0085CF]/5 border border-[#0085CF]/10 p-2 text-center">
          <div className="text-lg font-bold text-[#0085CF]">${catalog.stats.catalogValue.toLocaleString()}</div>
          <div className="text-[10px] text-gray-500">Total Value</div>
        </div>
      </div>

      <EditableSection
        section={catalog.sections.products}
        label="Products"
        renderView={(products) => <ProductGrid products={products} />}
        renderEditor={(products, onChange) => <ProductListEditor products={products} onChange={onChange} />}
        onRegenerate={(e) => api.regenerate("products", e)}
        onSaveAsIs={(c) => api.saveAsIs("products", c)}
        onApprove={(vid) => api.approve("products", vid)}
      />
    </div>
  );
}
