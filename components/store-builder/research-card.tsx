// components/store-builder/research-card.tsx
"use client";

import type { ResearchOutput } from "@/lib/store-builder/types";
import { EditableSection } from "./editable-section";
import { useSectionApi } from "./use-section-api";
import { ParagraphEditor, ParagraphView } from "./editors/paragraph-editor";
import { BulletListEditor, BulletListView } from "./editors/bullet-list-editor";
import { CompetitorEditor, CompetitorView } from "./editors/competitor-editor";
import { MarketPricingEditor, MarketPricingView } from "./editors/market-pricing-editor";
import { AudienceProfileEditor, AudienceProfileView } from "./editors/audience-profile-editor";
import { ProductRecEditor, ProductRecView } from "./editors/product-rec-editor";

interface Props {
  projectId: string;
  stageId: string;
  research: ResearchOutput;
  onSectionUpdated: (updatedResearch: ResearchOutput) => void;
}

export function ResearchCard({ projectId, stageId, research, onSectionUpdated }: Props) {
  const api = useSectionApi<ResearchOutput>(projectId, stageId, 1, onSectionUpdated);
  const s = research.sections;

  return (
    <div className="my-4 rounded-xl border border-[#0085CF]/15 bg-white p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-800">Market Research</h3>

      <EditableSection
        section={s.marketAnalysis}
        label="Market Analysis"
        renderView={(c) => <ParagraphView value={c} />}
        renderEditor={(c, onChange) => <ParagraphEditor value={c} onChange={onChange} />}
        onRegenerate={(e) => api.regenerate("marketAnalysis", e)}
        onSaveAsIs={(c) => api.saveAsIs("marketAnalysis", c)}
        onApprove={(vid) => api.approve("marketAnalysis", vid)}
      />

      <EditableSection
        section={s.competitiveLandscape}
        label="Competitive Landscape"
        renderView={(c) => <CompetitorView value={c} />}
        renderEditor={(c, onChange) => <CompetitorEditor value={c} onChange={onChange} />}
        onRegenerate={(e) => api.regenerate("competitiveLandscape", e)}
        onSaveAsIs={(c) => api.saveAsIs("competitiveLandscape", c)}
        onApprove={(vid) => api.approve("competitiveLandscape", vid)}
      />

      <EditableSection
        section={s.trends}
        label="Trends"
        renderView={(c) => <BulletListView value={c} />}
        renderEditor={(c, onChange) => <BulletListEditor value={c} onChange={onChange} placeholder="Trend" />}
        onRegenerate={(e) => api.regenerate("trends", e)}
        onSaveAsIs={(c) => api.saveAsIs("trends", c)}
        onApprove={(vid) => api.approve("trends", vid)}
      />

      <EditableSection
        section={s.targetAudienceProfile}
        label="Target Audience Profile"
        renderView={(c) => <AudienceProfileView value={c} />}
        renderEditor={(c, onChange) => <AudienceProfileEditor value={c} onChange={onChange} />}
        onRegenerate={(e) => api.regenerate("targetAudienceProfile", e)}
        onSaveAsIs={(c) => api.saveAsIs("targetAudienceProfile", c)}
        onApprove={(vid) => api.approve("targetAudienceProfile", vid)}
      />

      <EditableSection
        section={s.pricingStrategy}
        label="Pricing Strategy (per market)"
        renderView={(c) => <MarketPricingView value={c} />}
        renderEditor={(c, onChange) => <MarketPricingEditor value={c} onChange={onChange} />}
        onRegenerate={(e) => api.regenerate("pricingStrategy", e)}
        onSaveAsIs={(c) => api.saveAsIs("pricingStrategy", c)}
        onApprove={(vid) => api.approve("pricingStrategy", vid)}
      />

      <EditableSection
        section={s.productRecommendations}
        label="Product Recommendations"
        renderView={(c) => <ProductRecView value={c} />}
        renderEditor={(c, onChange) => <ProductRecEditor value={c} onChange={onChange} />}
        onRegenerate={(e) => api.regenerate("productRecommendations", e)}
        onSaveAsIs={(c) => api.saveAsIs("productRecommendations", c)}
        onApprove={(vid) => api.approve("productRecommendations", vid)}
      />
    </div>
  );
}
