"use client";

import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { MarkdownRenderer } from "@/components/markdown/markdown-renderer";
import { ResearchSteps } from "@/components/chat/inline/research-steps";
import { PresentationCard } from "@/components/artifacts/presentation-card";
import { CarouselCard } from "@/components/artifacts/carousel-card";
import { GammaCard } from "@/components/artifacts/gamma-card";
import { SheetCard } from "@/components/artifacts/sheet-card";
import { StoreBuilderChat } from "@/components/store-builder/store-builder-chat";
import { AgentSpecCard } from "@/components/agents/agent-spec-card";
import { RecruitmentBriefCard } from "@/components/recruitment/recruitment-brief-card";
import { InlineArtifactChips } from "@/components/artifacts/inline-artifact-chips";
import { ReviewCard } from "@/components/reviews/review-card";
import { FollowupPills } from "@/components/chat/followup-pills";
import { detectIntents } from "@/lib/intent-detector";
import { resolveSourceFromHistory, clampSourceText } from "@/lib/chat/resolve-reference";
import { useChatStore } from "@/stores/chat-store";
import { useChat } from "@/hooks/use-chat";
import type { QueryResponse } from "@/lib/types";

export function ConversationResponse({
  answer,
  durationMs,
  query,
  response,
  isFresh = true,
}: {
  answer: string;
  durationMs: number;
  query?: string;
  response?: QueryResponse | null;
  isFresh?: boolean;
}) {
  const detected = detectIntents(query ?? answer);
  const showPresentation = detected.intents.includes("presentation");
  const showCarousel = detected.intents.includes("carousel");
  const showGamma = detected.intents.includes("gamma");
  const showStoreBuilder = detected.intents.includes("store_builder");
  const showSheet = detected.intents.includes("sheet");
  const showRecruitment = detected.intents.includes("recruitment");

  const messages = useChatStore((s) => s.messages);
  const { sendMessage } = useChat();

  // Persisted chain-of-thought — collapsed by default, expands to the
  // expandable per-step rows (reusing the live component).
  const researchSteps = response?.research_steps;
  const [stepsOpen, setStepsOpen] = useState(false);

  // When the user's query references prior conversation ("make it a deck",
  // "put this in a sheet", "do 1 and 2"), seed the intent card with the most
  // recent substantive assistant message so the downstream generator has real
  // content to work with instead of just the short pronoun-y topic string.
  const sourceText = useMemo(() => {
    if (!query) return undefined;
    const resolved = resolveSourceFromHistory(messages, query);
    return clampSourceText(resolved);
  }, [messages, query]);

  return (
    <div className="text-gray-800">
      {researchSteps && researchSteps.length > 0 && (
        <div className="mb-3 max-w-[460px] rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
          <button
            type="button"
            onClick={() => setStepsOpen((o) => !o)}
            className="flex w-full items-center gap-1.5 text-left"
          >
            {stepsOpen ? (
              <ChevronDown className="size-3.5 shrink-0 text-gray-400" />
            ) : (
              <ChevronRight className="size-3.5 shrink-0 text-gray-400" />
            )}
            <span className="text-xs font-medium text-gray-600">
              Researched {researchSteps.length} step{researchSteps.length === 1 ? "" : "s"}
            </span>
          </button>
          {stepsOpen && (
            <div className="mt-2">
              <ResearchSteps steps={researchSteps} />
            </div>
          )}
        </div>
      )}

      <MarkdownRenderer content={answer} />

      {showPresentation && detected.presentationTarget === "canva" && (
        <PresentationCard topic={detected.topics.presentation} sourceText={sourceText} />
      )}

      {showCarousel && (
        <CarouselCard topic={detected.topics.carousel} sourceText={sourceText} />
      )}

      {showGamma && (
        <GammaCard topic={detected.topics.gamma} text={answer} sourceText={sourceText} />
      )}

      {showStoreBuilder && (
        <StoreBuilderChat topic={detected.topics.store_builder} />
      )}

      {showSheet && (
        <SheetCard
          topic={detected.topics.sheet || "Sheet"}
          sourceText={sourceText ?? answer}
          autoFire={isFresh}
        />
      )}

      {showRecruitment && (
        <RecruitmentBriefCard
          query={detected.topics.recruitment || query || answer}
          autoFire={isFresh}
        />
      )}

      {response?.agent_spec_card ? (
        <AgentSpecCard
          spec={response.agent_spec_card.spec}
          chatSessionId={response.agent_spec_card.chatSessionId}
          draftToken={response.agent_spec_card.draftToken}
        />
      ) : null}

      {response?.review_card ? <ReviewCard card={response.review_card} /> : null}

      {response?.agent_post?.runId ? (
        <InlineArtifactChips runId={response.agent_post.runId} />
      ) : null}

      {Array.isArray((response as { follow_ups?: string[] })?.follow_ups) &&
        (response as { follow_ups?: string[] }).follow_ups!.length > 0 && (
          <FollowupPills
            questions={(response as { follow_ups?: string[] }).follow_ups!}
            onPick={(q) => sendMessage(q)}
          />
        )}

      <span className="text-xs text-gray-400 mt-1 block">
        {(durationMs / 1000).toFixed(1)}s
      </span>
    </div>
  );
}
