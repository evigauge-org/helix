"use client";

import { useEffect, useState } from "react";
import { LiveCOT } from "@/components/chat/inline/live-cot";
import { ConversationResponse } from "./conversation-response";
import { MarkdownRenderer } from "@/components/markdown/markdown-renderer";
import type { ChatMessage, ResearchProgress } from "@/lib/types";
import Image from "next/image";

function AiAvatar() {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full mt-0.5">
      <Image src="/Siri.png" alt="Helix" width={32} height={32} className="size-8 drop-shadow" />
    </div>
  );
}

const CASUAL_PHRASES = [
  "Thinking",
  "Doing stuff",
  "Lollygagging",
  "Cooking it up",
  "Noodling on it",
  "Pondering",
  "Spinning the wheels",
  "Brewing an answer",
];

function CasualThinking() {
  const [phrase, setPhrase] = useState(() => CASUAL_PHRASES[Math.floor(Math.random() * CASUAL_PHRASES.length)]);
  useEffect(() => {
    const t = setInterval(() => {
      setPhrase(CASUAL_PHRASES[Math.floor(Math.random() * CASUAL_PHRASES.length)]);
    }, 2600);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="helix-shimmer text-base font-medium">
      {phrase}
      <span className="helix-shimmer">...</span>
    </span>
  );
}

export function AIResponse({ message, researchSteps, hasFiles }: { message: ChatMessage; researchSteps: ResearchProgress[]; hasFiles?: boolean }) {
  // Streaming — show content as it arrives
  if (message.isStreaming) {
    const isCasual = message.mode === "casual";
    const hasSteps = researchSteps.length > 0;
    return (
      <div className="flex items-start gap-3">
        <AiAvatar />
        <div className="max-w-[85%] min-w-0">
          {message.content ? (
            <div className="text-gray-800">
              {/* Keep the accumulated research feed visible above the streaming answer. */}
              {hasSteps && <LiveCOT hasFiles={hasFiles} researchSteps={researchSteps} />}
              <MarkdownRenderer content={message.content} isStreaming={true} />
              <span className="inline-block size-2 rounded-full bg-[#0085CF] animate-pulse ml-1 align-middle" />
            </div>
          ) : isCasual ? (
            <CasualThinking />
          ) : (
            <LiveCOT hasFiles={hasFiles} researchSteps={researchSteps} />
          )}
        </div>
      </div>
    );
  }

  const response = message.response;

  // Error
  if (!response || !response.success) {
    return (
      <div className="flex items-start gap-3">
        <AiAvatar />
        <div className="max-w-[85%] text-sm text-red-600">
          {message.content || "Something went wrong."}
        </div>
      </div>
    );
  }

  // All successful responses render via ConversationResponse.
  // "Fresh" = message created in the current ~30s window. Auto-firing
  // cards (Sheet / Presentation / etc.) only trigger their generation on
  // fresh messages — navigating back to an old chat re-mounts the cards
  // but they see a stale createdAt and render in idle state instead of
  // re-running the expensive generation.
  const createdAt = message.createdAt ? new Date(message.createdAt).getTime() : 0;
  const isFresh = createdAt > 0 && Date.now() - createdAt < 30_000;
  return (
    <div className="flex items-start gap-3">
      <AiAvatar />
      <div className="max-w-[85%] min-w-0">
        <ConversationResponse
          answer={response.answer}
          durationMs={response.duration_ms}
          query={response.query}
          response={response}
          isFresh={isFresh}
        />
      </div>
    </div>
  );
}
