"use client";

import { useState } from "react";
import { Share2, Eye, X, Image as ImageIcon } from "lucide-react";
import type { SocialOutput, SuggestedCaption } from "@/lib/store-builder/types";
import { EditableSection } from "./editable-section";
import { BulletListEditor, BulletListView } from "./editors/bullet-list-editor";
import { useSectionApi } from "./use-section-api";

interface Props {
  projectId: string;
  stageId: string;
  social: SocialOutput;
  onSectionUpdated: (updated: SocialOutput) => void;
}

function CaptionsEditor({ value, onChange }: { value: SuggestedCaption[]; onChange: (v: SuggestedCaption[]) => void }) {
  return (
    <div className="space-y-2">
      {value.map((c, i) => (
        <div key={i} className="space-y-1">
          <textarea
            value={c.text}
            onChange={(e) => { const n = [...value]; n[i] = { ...n[i], text: e.target.value }; onChange(n); }}
            rows={2}
            className="w-full rounded border border-gray-200 px-2 py-1 text-sm resize-none"
          />
          <input
            value={c.hashtags.join(" ")}
            onChange={(e) => { const n = [...value]; n[i] = { ...n[i], hashtags: e.target.value.split(/\s+/).filter(Boolean) }; onChange(n); }}
            placeholder="Hashtags (space separated)"
            className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
          />
        </div>
      ))}
    </div>
  );
}

function CaptionsView({ value }: { value: SuggestedCaption[] }) {
  return (
    <ul className="space-y-1.5 text-sm text-gray-700">
      {value.map((c, i) => (
        <li key={i}>{c.text} <span className="text-gray-400 text-xs">#{c.hashtags.join(" #")}</span></li>
      ))}
    </ul>
  );
}

export function SocialCard({ projectId, stageId, social, onSectionUpdated }: Props) {
  const api = useSectionApi<SocialOutput>(projectId, stageId, 4, onSectionUpdated);
  const [carouselPreview, setCarouselPreview] = useState(false);

  return (
    <div className="my-4 rounded-xl border border-[#0085CF]/15 bg-white p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-pink-100">
          <Share2 className="size-5 text-pink-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">Social Media Kit</p>
          <p className="text-xs text-gray-500">Carousel · Cover images · Captions</p>
        </div>
      </div>

      {social.carouselHtml && (
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Brand Launch Carousel</p>
          <button onClick={() => setCarouselPreview(true)} className="w-full flex items-center justify-center gap-2 rounded-lg border border-pink-200 bg-pink-50 p-4 hover:bg-pink-100 transition-colors cursor-pointer">
            <Eye className="size-4 text-pink-600" />
            <span className="text-sm font-medium text-pink-700">Preview Carousel</span>
          </button>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 flex items-center gap-1"><ImageIcon className="size-3" /> Cover Images</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: "instagram", label: "Instagram", img: social.coverImages.instagram },
            { key: "facebook", label: "Facebook", img: social.coverImages.facebook },
            { key: "shopifyHero", label: "Shopify Hero", img: social.coverImages.shopifyHero },
          ].map((cover) => (
            <div key={cover.key} className="rounded-lg border border-gray-200 overflow-hidden">
              {cover.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover.img} alt={cover.label} className="w-full h-20 object-cover" />
              ) : (
                <div className="w-full h-20 bg-gray-100 flex items-center justify-center text-xs text-gray-400">No image</div>
              )}
              <p className="text-[10px] text-gray-500 text-center py-1">{cover.label}</p>
            </div>
          ))}
        </div>
      </div>

      <EditableSection
        section={social.sections.captionTemplates}
        label="Caption Templates"
        renderView={(c) => <CaptionsView value={c} />}
        renderEditor={(c, onChange) => <CaptionsEditor value={c} onChange={onChange} />}
        onRegenerate={(e) => api.regenerate("captionTemplates", e)}
        onSaveAsIs={(c) => api.saveAsIs("captionTemplates", c)}
        onApprove={(vid) => api.approve("captionTemplates", vid)}
      />

      <EditableSection
        section={social.sections.hashtagSet}
        label="Hashtag Set"
        renderView={(tags) => <BulletListView value={tags} />}
        renderEditor={(tags, onChange) => <BulletListEditor value={tags} onChange={onChange} placeholder="Hashtag" />}
        onRegenerate={(e) => api.regenerate("hashtagSet", e)}
        onSaveAsIs={(c) => api.saveAsIs("hashtagSet", c)}
        onApprove={(vid) => api.approve("hashtagSet", vid)}
      />

      {carouselPreview && social.carouselHtml && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="relative bg-white rounded-xl overflow-hidden max-w-[480px] w-full max-h-[90vh]">
            <button onClick={() => setCarouselPreview(false)} className="absolute top-3 right-3 z-10 flex size-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 cursor-pointer">
              <X className="size-4" />
            </button>
            <iframe
              srcDoc={
                social.carouselHtml.trim().startsWith("<!DOCTYPE") || social.carouselHtml.trim().startsWith("<html")
                  ? social.carouselHtml
                  : `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#f5f5f5;display:flex;justify-content:center;padding:20px;color:#1a1a1a}</style></head><body><div style="max-width:420px;width:100%;background:white;border-radius:12px;padding:24px;box-shadow:0 2px 20px rgba(0,0,0,0.1)">${social.carouselHtml}</div></body></html>`
              }
              className="w-full border-0"
              style={{ height: "80vh" }}
              sandbox="allow-scripts"
              title="Carousel Preview"
            />
          </div>
        </div>
      )}
    </div>
  );
}
