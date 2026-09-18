"use client";

import { ShoppingCart, ExternalLink, Check, Package, FolderOpen, FileText, Palette } from "lucide-react";
import type { ShopifyOutput } from "@/lib/store-builder/types";
import { EditableSection } from "./editable-section";
import { BulletListEditor, BulletListView } from "./editors/bullet-list-editor";
import { ParagraphEditor, ParagraphView } from "./editors/paragraph-editor";
import { useSectionApi } from "./use-section-api";

interface Props {
  projectId: string;
  stageId: string;
  shopify: ShopifyOutput;
  onSectionUpdated: (updated: ShopifyOutput) => void;
}

export function ShopifyCard({ projectId, stageId, shopify, onSectionUpdated }: Props) {
  const api = useSectionApi<ShopifyOutput>(projectId, stageId, 5, onSectionUpdated);

  return (
    <div className="my-4 rounded-xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/50 p-4 shadow-sm space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md">
          <ShoppingCart className="size-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-800">Shopify Store Ready!</p>
          <p className="text-xs text-gray-500">Your store is live and ready to share</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-lg bg-white border border-emerald-100 p-2 text-center">
          <Package className="size-4 text-emerald-600 mx-auto mb-1" />
          <div className="text-lg font-bold text-emerald-700">{shopify.productsUploaded}</div>
          <div className="text-[10px] text-gray-500">Products</div>
        </div>
        <div className="rounded-lg bg-white border border-emerald-100 p-2 text-center">
          <FolderOpen className="size-4 text-emerald-600 mx-auto mb-1" />
          <div className="text-lg font-bold text-emerald-700">{shopify.collectionsCreated.length}</div>
          <div className="text-[10px] text-gray-500">Collections</div>
        </div>
        <div className="rounded-lg bg-white border border-emerald-100 p-2 text-center">
          <FileText className="size-4 text-emerald-600 mx-auto mb-1" />
          <div className="text-lg font-bold text-emerald-700">{shopify.pagesCreated.length}</div>
          <div className="text-[10px] text-gray-500">Pages</div>
        </div>
        <div className="rounded-lg bg-white border border-emerald-100 p-2 text-center">
          <Palette className="size-4 text-emerald-600 mx-auto mb-1" />
          <div className="text-lg font-bold text-emerald-700">{shopify.themeCustomized ? "✓" : "—"}</div>
          <div className="text-[10px] text-gray-500">Theme</div>
        </div>
      </div>

      <EditableSection
        section={shopify.sections.launchChecklist}
        label="Launch Checklist"
        renderView={(items) => <BulletListView value={items} />}
        renderEditor={(items, onChange) => <BulletListEditor value={items} onChange={onChange} placeholder="Checklist item" />}
        onRegenerate={(e) => api.regenerate("launchChecklist", e)}
        onSaveAsIs={(c) => api.saveAsIs("launchChecklist", c)}
        onApprove={(vid) => api.approve("launchChecklist", vid)}
      />

      <EditableSection
        section={shopify.sections.themeNotes}
        label="Theme Notes"
        renderView={(v) => <ParagraphView value={v} />}
        renderEditor={(v, onChange) => <ParagraphEditor value={v} onChange={onChange} rows={3} />}
        onRegenerate={(e) => api.regenerate("themeNotes", e)}
        onSaveAsIs={(c) => api.saveAsIs("themeNotes", c)}
        onApprove={(vid) => api.approve("themeNotes", vid)}
      />

      <div className="flex gap-2">
        <a href={shopify.storeUrl} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:from-emerald-700 hover:to-teal-700 transition-all cursor-pointer shadow-sm">
          <ExternalLink className="size-4" /> View Store
        </a>
        <a href={shopify.adminUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border border-emerald-200 px-4 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer">
          <Check className="size-4" /> Admin
        </a>
      </div>
    </div>
  );
}
