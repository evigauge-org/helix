"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/stores/chat-store";
import { MessageBubble } from "./message-bubble";
import { AIResponse } from "./ai-response";
import { ErrorBoundary } from "@/components/error-boundary";

export function ChatArea() {
  const messages = useChatStore((s) => s.messages);
  const researchSteps = useChatStore((s) => s.researchSteps);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, researchSteps]);

  return (
    <div ref={containerRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-white px-4">
      <div className="mx-auto w-full max-w-3xl min-w-0 space-y-6 py-6">
        {messages.map((msg, idx) => {
          if (msg.role === "user") {
            return <MessageBubble key={msg.id} message={msg} />;
          }

          // Check if the preceding user message had files
          const prevMsg = idx > 0 ? messages[idx - 1] : null;
          const hasFiles = !!(prevMsg?.files && prevMsg.files.length > 0);

          // Per-message boundary: one bad render can't kill the whole thread.
          return (
            <ErrorBoundary key={msg.id}>
              <AIResponse
                message={msg}
                researchSteps={msg.isStreaming ? researchSteps : []}
                hasFiles={hasFiles}
              />
            </ErrorBoundary>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
