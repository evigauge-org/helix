"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/stores/chat-store";
import { useChat } from "@/hooks/use-chat";
import { Greeting } from "./greeting";
import { ChatInputCentered } from "./chat-input-centered";
import { SuggestionPills } from "./suggestion-pills";
import { ChatArea } from "./chat-area";
import { ChatInput } from "./chat-input";
import { ArtifactsToggleButton } from "@/components/artifacts/artifacts-toggle-button";

export function AuthenticatedChatView() {
  const messages = useChatStore((s) => s.messages);
  const newChat = useChatStore((s) => s.newChat);
  const hasMessages = messages.length > 0;
  const { sendMessage } = useChat();
  const initHandled = useRef(false);

  // On first mount: always start fresh + check for pending query from landing page
  useEffect(() => {
    if (initHandled.current) return;
    initHandled.current = true;

    const raw = localStorage.getItem("helix-pending-query");

    if (raw) {
      // Pending query from pre-sign-in — run it in a new chat
      localStorage.removeItem("helix-pending-query");
      newChat();
      try {
        const pending = JSON.parse(raw) as { query: string; fileNames?: string[] };
        if (pending.query) {
          setTimeout(() => sendMessage(pending.query), 500);
        }
      } catch {
        // ignore malformed data
      }
    } else {
      // No pending query — just ensure a fresh chat screen (greeting + centered input)
      newChat();
    }
  }, [newChat, sendMessage]);

  if (hasMessages) {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/bg.png"
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.04]"
        />
        <ArtifactsToggleButton />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <ChatArea />
          <ChatInput />
        </div>
      </div>
    );
  }

  // No messages — greeting + centered input + suggestion pills
  return (
    <div className="relative flex flex-1 flex-col">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/bg.png"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.08] blur-sm"
      />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-start px-6 pt-[18vh] sm:pt-[22vh]">
        <Greeting />
        <ChatInputCentered />
        <SuggestionPills />
      </div>
    </div>
  );
}
