"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ResearchCard } from "./research-card";
import { CatalogCard } from "./catalog-card";
import { BrandCard } from "./brand-card";
import { SocialCard } from "./social-card";
import { ShopifyCard } from "./shopify-card";
import { LiveCOT } from "@/components/chat/inline/live-cot";
import { detectStoreBuilderIntent } from "@/lib/intent-detector";
import { BrandClarifierCard } from "./brand-clarifier-card";
import { BrainstormResponse } from "./brainstorm-response";
import type {
  StoreBrief, BrandCategory,
  ResearchOutput, CatalogOutput, BrandingOutput, SocialOutput, ShopifyOutput,
} from "@/lib/store-builder/types";

type Phase =
  | "clarifier"
  | "brainstorm"
  | "researching"
  | "research_review"
  | "catalog_generating"
  | "catalog_review"
  | "branding_generating"
  | "brand_review"
  | "social_generating"
  | "social_review"
  | "shopify_generating"
  | "shopify_review"
  | "completed";

interface ClarifierInit {
  category: BrandCategory;
  customType?: string;
}

interface StageSnapshot {
  id: string;
  stage: number;
  status: string;
  output: unknown;
}

const BRAINSTORM_SUGGESTIONS: { label: string; description: string }[] = [
  { label: "Clothing brand", description: "Apparel, fashion, streetwear, athleisure" },
  { label: "Electronics brand", description: "Gadgets, smart home, audio, wearables" },
  { label: "Digital brand", description: "SaaS, courses, templates, info products" },
  { label: "Other custom brand", description: "Something unique — pet, decor, beauty, etc." },
];

const BRAINSTORM_MESSAGE =
  "Exciting! Let's narrow it down. Which of these feels closest to what you have in mind? Pick one and I'll walk you through the details.";

export function StoreBuilderChat({ topic }: { topic: string }) {
  const [phase, setPhase] = useState<Phase>(() => {
    const detected = detectStoreBuilderIntent(topic);
    if (detected.subIntent === "specific-category") return "clarifier";
    if (detected.subIntent === "vague-brand-intent") return "brainstorm";
    return "clarifier";
  });
  const [clarifierInit, setClarifierInit] = useState<ClarifierInit>(() => {
    const detected = detectStoreBuilderIntent(topic);
    if (detected.subIntent === "specific-category" && detected.category) {
      return {
        category: detected.category,
        customType: detected.category === "other" ? detected.freeText : undefined,
      };
    }
    return { category: "clothing" };
  });
  const [projectId, setProjectId] = useState<string | null>(null);
  const [stageIds, setStageIds] = useState<Record<number, string>>({});
  const [researchData, setResearchData] = useState<ResearchOutput | null>(null);
  const [catalogData, setCatalogData] = useState<CatalogOutput | null>(null);
  const [brandData, setBrandData] = useState<BrandingOutput | null>(null);
  const [socialData, setSocialData] = useState<SocialOutput | null>(null);
  const [shopifyData, setShopifyData] = useState<ShopifyOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const pollStatus = useCallback(
    (id: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/store-builder/${id}`);
          if (!res.ok) return;
          const { project } = await res.json();
          const stages: StageSnapshot[] = project.stages ?? [];
          setStageIds((prev) => {
            const next = { ...prev };
            for (const s of stages) next[s.stage] = s.id;
            return next;
          });
          const stage1 = stages.find((s) => s.stage === 1);
          const stage2 = stages.find((s) => s.stage === 2);
          const stage3 = stages.find((s) => s.stage === 3);
          const stage4 = stages.find((s) => s.stage === 4);
          const stage5 = stages.find((s) => s.stage === 5);

          if (stage1?.status === "awaiting_approval" && !researchData) {
            setResearchData(stage1.output as ResearchOutput); setPhase("research_review"); stopPolling();
          } else if (stage2?.status === "awaiting_approval" && !catalogData) {
            setCatalogData(stage2.output as CatalogOutput); setPhase("catalog_review"); stopPolling();
          } else if (stage3?.status === "awaiting_approval" && !brandData) {
            setBrandData(stage3.output as BrandingOutput); setPhase("brand_review"); stopPolling();
          } else if (stage4?.status === "awaiting_approval" && !socialData) {
            setSocialData(stage4.output as SocialOutput); setPhase("social_review"); stopPolling();
          } else if (stage5?.status === "awaiting_approval" && !shopifyData) {
            setShopifyData(stage5.output as ShopifyOutput); setPhase("shopify_review"); stopPolling();
          } else if (project.status === "completed" || project.status === "failed") {
            stopPolling();
            if (project.status === "completed") setPhase("completed");
          }
        } catch { /* keep polling */ }
      }, 5000);
    },
    [researchData, catalogData, brandData, socialData, shopifyData],
  );

  useEffect(() => () => stopPolling(), []);

  const handleClarifierSubmit = async (brief: StoreBrief) => {
    setLoading(true);
    try {
      const res = await fetch("/api/store-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      const { project } = await res.json();
      setProjectId(project.id);
      setPhase("researching");
      pollStatus(project.id);
    } catch (err) {
      console.error("Failed to start project:", err);
    } finally {
      setLoading(false);
    }
  };

  const stageFromPhase = (p: Phase): number | null => {
    switch (p) {
      case "research_review": return 1;
      case "catalog_review":  return 2;
      case "brand_review":    return 3;
      case "social_review":   return 4;
      case "shopify_review":  return 5;
      default: return null;
    }
  };

  const handleApprove = async () => {
    if (!projectId) return;
    const stage = stageFromPhase(phase);
    if (stage === null) return;
    setLoading(true);
    try {
      await fetch(`/api/store-builder/${projectId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, autoApproveRemaining: true }),
      });

      if (phase === "research_review") { setPhase("catalog_generating");  pollStatus(projectId); }
      else if (phase === "catalog_review")  { setPhase("branding_generating"); pollStatus(projectId); }
      else if (phase === "brand_review")    { setPhase("social_generating");   pollStatus(projectId); }
      else if (phase === "social_review")   { setPhase("shopify_generating");  pollStatus(projectId); }
      else if (phase === "shopify_review")  { setPhase("completed"); }
    } catch (err) {
      console.error("Approve failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBrainstormPick = (label: string) => {
    const detected = detectStoreBuilderIntent(`build a ${label}`);
    if (detected.subIntent === "specific-category" && detected.category) {
      setClarifierInit({
        category: detected.category,
        customType: detected.category === "other" ? label : undefined,
      });
      setPhase("clarifier");
    }
  };

  const stage1Id = stageIds[1];
  const stage2Id = stageIds[2];
  const stage3Id = stageIds[3];
  const stage4Id = stageIds[4];
  const stage5Id = stageIds[5];

  return (
    <div>
      {phase === "clarifier" && (
        <BrandClarifierCard
          initialCategory={clarifierInit.category}
          initialCustomType={clarifierInit.customType}
          onSubmit={handleClarifierSubmit}
          loading={loading}
        />
      )}

      {phase === "brainstorm" && (
        <BrainstormResponse
          message={BRAINSTORM_MESSAGE}
          suggestedCategories={BRAINSTORM_SUGGESTIONS}
          onPickCategory={handleBrainstormPick}
        />
      )}

      {(phase === "researching" ||
        phase === "catalog_generating" ||
        phase === "branding_generating" ||
        phase === "social_generating" ||
        phase === "shopify_generating") && <LiveCOT hasFiles={false} />}

      {phase === "research_review" && researchData && projectId && stage1Id && (
        <>
          <ResearchCard
            projectId={projectId}
            stageId={stage1Id}
            research={researchData}
            onSectionUpdated={setResearchData}
          />
          <button onClick={handleApprove} disabled={loading} className="mt-2 w-full rounded-lg bg-[#0085CF] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#006BA6] disabled:opacity-50 cursor-pointer">
            {loading ? "Approving…" : "Approve stage & continue →"}
          </button>
        </>
      )}

      {phase === "catalog_review" && catalogData && projectId && stage2Id && (
        <>
          <CatalogCard
            projectId={projectId}
            stageId={stage2Id}
            catalog={catalogData}
            onSectionUpdated={setCatalogData}
          />
          <button onClick={handleApprove} disabled={loading} className="mt-2 w-full rounded-lg bg-[#0085CF] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#006BA6] disabled:opacity-50 cursor-pointer">
            {loading ? "Approving…" : "Approve stage & continue →"}
          </button>
        </>
      )}

      {phase === "brand_review" && brandData && projectId && stage3Id && (
        <>
          <BrandCard
            projectId={projectId}
            stageId={stage3Id}
            branding={brandData}
            onSectionUpdated={setBrandData}
          />
          <button onClick={handleApprove} disabled={loading} className="mt-2 w-full rounded-lg bg-[#0085CF] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#006BA6] disabled:opacity-50 cursor-pointer">
            {loading ? "Approving…" : "Approve stage & continue →"}
          </button>
        </>
      )}

      {phase === "social_review" && socialData && projectId && stage4Id && (
        <>
          <SocialCard
            projectId={projectId}
            stageId={stage4Id}
            social={socialData}
            onSectionUpdated={setSocialData}
          />
          <button onClick={handleApprove} disabled={loading} className="mt-2 w-full rounded-lg bg-[#0085CF] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#006BA6] disabled:opacity-50 cursor-pointer">
            {loading ? "Approving…" : "Approve stage & continue →"}
          </button>
        </>
      )}

      {phase === "shopify_review" && shopifyData && projectId && stage5Id && (
        <>
          <ShopifyCard
            projectId={projectId}
            stageId={stage5Id}
            shopify={shopifyData}
            onSectionUpdated={setShopifyData}
          />
          <button onClick={handleApprove} disabled={loading} className="mt-2 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer">
            {loading ? "Finalizing…" : "Complete Setup"}
          </button>
        </>
      )}

      {phase === "completed" && shopifyData && projectId && stage5Id && (
        <ShopifyCard
          projectId={projectId}
          stageId={stage5Id}
          shopify={shopifyData}
          onSectionUpdated={setShopifyData}
        />
      )}

      {phase === "completed" && !shopifyData && (
        <div className="my-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center space-y-2">
          <p className="text-sm font-semibold text-emerald-800">&#x2713; Store build complete!</p>
          <p className="text-xs text-emerald-600">All 5 stages finished successfully.</p>
        </div>
      )}
    </div>
  );
}
