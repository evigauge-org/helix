"use client";

import { useCallback } from "react";
import { useChatStore } from "@/stores/chat-store";
import { useUIStore } from "@/stores/ui-store";
import { decideRoute } from "@/lib/chat/router";
import type { AttachedFile, QueryResponse, ResearchStepDetail } from "@/lib/types";
import type { Classification } from "@/lib/chat/deep-research-classifier";

const AGENT_INTENT_PATTERNS = [
  /\bcreate (an? )?agent\b/i,
  /\bmake (an? )?agent\b/i,
  /\bset up (an? )?worker\b/i,
  /\bset up (an? )?agent\b/i,
  /\bagent that\b/i,
  /\bautonomous (ai|worker|agent)\b/i,
  /\bpitch book\b/i,
  /\bsell[- ]side\b/i,
  /\bbuy[- ]side\b/i,
  /\b(M&A|m and a|mna)\s+(advisor(y|s)?|mandate|process|deal)\b/i,
  /\bstrategic alternatives\b/i,
  /\bstrategic acquirers?\b/i,
  /\bcomp(arable)?\s+transactions?\b/i,
];
function looksLikeAgentIntent(msg: string): boolean {
  return AGENT_INTENT_PATTERNS.some((r) => r.test(msg));
}

async function classifyOnServer(sessionId: string, userMessage: string): Promise<Classification> {
  try {
    const res = await fetch("/api/chat/research-followup/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, userMessage }),
    });
    if (!res.ok) return { kind: "new_research", messageId: null, searchQuery: null };
    return (await res.json()) as Classification;
  } catch {
    return { kind: "new_research", messageId: null, searchQuery: null };
  }
}

function trackQuery(query: string, response: QueryResponse) {
  fetch("/api/track-query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      answer: response.answer,
      tier: response.tier,
      tokensUsed: response.tokens?.total ?? 0,
      cost: 0,
      latencyMs: response.duration_ms,
      confidence: response.confidence,
      agentsUsed: response.agents_used ?? ["openrouter/gemma-3-27b-it"],
      cached: response.cache?.hit ?? false,
    }),
  }).catch(() => {});
}

function generateTitle(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length <= 40) return trimmed;
  return trimmed.slice(0, 40) + "...";
}

// Ensure we have a DB-backed session ID before calling server routes that
// write chat messages keyed by sessionId. If one already exists, return it.
// Otherwise, create one now and update the store.
async function ensureDbSessionId(content: string): Promise<string> {
  const state = useChatStore.getState();
  if (state.activeSessionId) return state.activeSessionId;

  const res = await fetch("/api/chat-sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: generateTitle(content) }),
  });
  if (!res.ok) throw new Error("Failed to create chat session");
  const data = await res.json();
  const id: string | undefined = data.session?.id;
  if (!id) throw new Error("Chat session create returned no id");

  const now = new Date().toISOString();
  useChatStore.setState((s) => {
    const exists = s.sessions.some((sess) => sess.id === id);
    return {
      activeSessionId: id,
      sessions: exists
        ? s.sessions
        : [
            { id, title: generateTitle(content), messages: [], createdAt: now, updatedAt: now },
            ...s.sessions,
          ],
    };
  });
  return id;
}

export function useChat() {
  const {
    messages, addUserMessage, addAssistantMessage, appendToAssistantMessage,
    updateAssistantMessage, setLoading, setStreaming, pushResearchStep, updateResearchStep, clearResearchSteps,
  } = useChatStore();

  const sendMessage = useCallback(
    async (content: string, files?: AttachedFile[], knowledgeDraftToken?: string) => {
      const hasFiles = !!files && files.length > 0;
      const deepResearch = useUIStore.getState().deepResearch;
      const memoryPaused = useUIStore.getState().memoryPaused;

      const route = decideRoute({ message: content, hasFiles, deepResearch });

      // Casual chat lane — dispatch through OpenRouter via /api/chat/stream.
      // The server route handles BOTH user+assistant DB persistence, so we
      // pass skipPersist to the store to avoid double-writes.
      if (route.kind !== "backend") {
        let assistantId: string | null = null;
        setLoading(true);
        clearResearchSteps();
        const startedAt = Date.now();
        let accumulated = "";
        try {
          // 1. Ensure DB session exists first (server needs a real sessionId).
          const sessionId = await ensureDbSessionId(content);

          // 2b. Agent intent detection — short-circuit with extracted spec card.
          //     This branch does NOT hit /api/chat/stream, so both the user
          //     message and the assistant spec card must be persisted
          //     client-side (no skipPersist) so they survive reload.
          if (looksLikeAgentIntent(content)) {
            try {
              const resp = await fetch("/api/agents/spec-from-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userMessage: content, draftToken: knowledgeDraftToken }),
              });
              if (resp.ok) {
                const spec = await resp.json();
                if (!spec.error) {
                  addUserMessage(content, undefined);
                  const assistantIdSpec = crypto.randomUUID();
                  addAssistantMessage(assistantIdSpec, { mode: "casual" });
                  setStreaming(assistantIdSpec, false);
                  updateAssistantMessage(
                    assistantIdSpec,
                    {
                      query: content,
                      tier: 0,
                      success: true,
                      answer: `I extracted an agent spec for you. Review and confirm below.`,
                      confidence: 1,
                      duration_ms: 0,
                      conversation_mode: true,
                      agents_used: ["anthropic/claude-haiku-4.5"],
                      // Custom field carried through on the response; UI renders defensively.
                      agent_spec_card: {
                        spec,
                        chatSessionId: sessionId,
                        draftToken: knowledgeDraftToken,
                      },
                    } as never,
                  );
                  setLoading(false);
                  return;
                }
              }
            } catch {
              // Fall through to normal casual-chat flow on error.
            }
          }

          // 2. Normal openrouter streaming lane — server /api/chat/stream
          //    persists both turns, so skipPersist avoids double-writes.
          addUserMessage(content, undefined, { skipPersist: true });

          // 3. Append empty assistant placeholder NOW so the casual shimmer
          //    renders during the context build + stream handshake.
          assistantId = crypto.randomUUID();
          addAssistantMessage(assistantId, { mode: "casual" });

          // 4. Build context via API.
          const ctxRes = await fetch("/api/chat/context", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, userMessage: content, memoryPaused }),
          });
          if (!ctxRes.ok) throw new Error("Failed to build context");
          const { systemPrompt, messages: ctxMessages } = await ctxRes.json();

          // 5. Stream response from /api/chat/stream.
          const streamRes = await fetch("/api/chat/stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, systemPrompt, messages: ctxMessages }),
          });
          if (!streamRes.ok || !streamRes.body) throw new Error("Stream failed");

          const reader = streamRes.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const payload = line.slice(6).trim();
              if (payload === "[DONE]") continue;
              try {
                const { delta } = JSON.parse(payload) as { delta?: string };
                if (delta && assistantId) {
                  accumulated += delta;
                  appendToAssistantMessage(assistantId, delta);
                }
              } catch {}
            }
          }

          if (assistantId) {
            setStreaming(assistantId, false);
            updateAssistantMessage(
              assistantId,
              {
                query: content,
                tier: 0,
                success: true,
                answer: accumulated,
                confidence: 1,
                duration_ms: Date.now() - startedAt,
                conversation_mode: true,
                agents_used: ["openrouter/gemma-4-26b-a4b-it"],
              },
              { skipPersist: true },
            );
          }
        } catch (error) {
          if (assistantId) {
            updateAssistantMessage(assistantId, {
              query: content,
              tier: 0,
              success: false,
              answer: `Error: ${error instanceof Error ? error.message : "Something went wrong"}`,
              confidence: 0,
              duration_ms: 0,
            });
          }
        } finally {
          setLoading(false);
          clearResearchSteps();
        }
        return;
      }

      // All other lanes (backend / store-builder / carousel / presentation /
      // gamma) → existing backend path. Dedicated flows have their own UIs;
      // the default chat path just routes to backend.

      // Deep Research follow-up classification (no-files + backend route only).
      // If the classifier identifies this message as a follow-up to a prior
      // research response in this session, stream a lightweight follow-up
      // answer instead of re-running the full research pipeline.
      if (route.kind === "backend" && !hasFiles) {
        try {
          const sessionId = await ensureDbSessionId(content);
          const classification = await classifyOnServer(sessionId, content);
          if (
            (classification.kind === "followup_from_context" ||
              classification.kind === "followup_with_web") &&
            classification.messageId
          ) {
            // Server persists both user + assistant in the follow-up stream route,
            // so skip client-side DB write here to avoid duplicate rows.
            addUserMessage(content, undefined, { skipPersist: true });
            const assistantId = crypto.randomUUID();
            addAssistantMessage(assistantId, { mode: "research" });
            setLoading(true);
            clearResearchSteps();
            let accumulated = "";
            const startedAt = Date.now();
            try {
              const res = await fetch("/api/chat/research-followup/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  sessionId,
                  priorMessageId: classification.messageId,
                  userMessage: content,
                  searchQuery: classification.searchQuery,
                }),
              });
              if (!res.ok || !res.body) throw new Error(`Follow-up stream failed: ${res.status}`);
              const reader = res.body.getReader();
              const decoder = new TextDecoder();
              let buffer = "";
              while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                  if (!line.startsWith("data: ")) continue;
                  const payload = line.slice(6).trim();
                  if (payload === "[DONE]") continue;
                  try {
                    const { delta } = JSON.parse(payload) as { delta?: string };
                    if (delta) {
                      accumulated += delta;
                      appendToAssistantMessage(assistantId, delta);
                    }
                  } catch {}
                }
              }
              setStreaming(assistantId, false);
              updateAssistantMessage(
                assistantId,
                {
                  query: content,
                  tier: 0,
                  success: true,
                  answer: accumulated,
                  confidence: 1,
                  duration_ms: Date.now() - startedAt,
                  conversation_mode: true,
                  agents_used: ["openrouter/gemma-4-26b-a4b-it"],
                },
                { skipPersist: true },
              );
            } catch (err) {
              updateAssistantMessage(
                assistantId,
                {
                  query: content,
                  tier: 0,
                  success: false,
                  answer: `Follow-up failed: ${err instanceof Error ? err.message : "unknown"}`,
                  confidence: 0,
                  duration_ms: 0,
                },
                { skipPersist: true },
              );
            } finally {
              setLoading(false);
              clearResearchSteps();
            }
            return;
          }
          // new_research → fall through to existing backend path below.
        } catch {
          // Classifier failed — fall through to existing backend path.
        }
      }

      if (hasFiles) {
        // Attach UI is kept (design) but local file ingestion is a future task.
        // No server call on this branch, so the client persists the user row.
        addUserMessage(content, files);
        const assistantId = crypto.randomUUID();
        addAssistantMessage(assistantId, { mode: "research" });
        setStreaming(assistantId, false);
        updateAssistantMessage(assistantId, {
          query: content,
          tier: 0,
          success: false,
          answer: "File attachments aren't supported in research mode yet — they'll be wired to local RAG soon. Ask without a file for now.",
          confidence: 0,
          duration_ms: 0,
          conversation_mode: true,
        });
        setLoading(false);
        return;
      }

      // Adaptive web-research branch. Create the DB session first; the adaptive
      // route (app/api/research/adaptive/stream) persists the user row, so add
      // the user message with skipPersist to avoid a duplicate write.
      const sessionId = await ensureDbSessionId(content);
      addUserMessage(content, undefined, { skipPersist: true });
      const assistantId = crypto.randomUUID();
      addAssistantMessage(assistantId, { mode: "research" });
      setLoading(true);
      clearResearchSteps();

      try {
        const history = messages
          .filter((m) => m.role === "user" || (m.role === "assistant" && m.content))
          .slice(-10)
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

        const res = await fetch("/api/research/adaptive/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, query: content, history }),
        });
        if (!res.ok || !res.body) throw new Error(`Adaptive research failed: ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let answer = "";
        let sources: unknown[] = [];
        let followUps: string[] = [];
        const startedAt = Date.now();

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") continue;
            // Parse in a narrow try so malformed frames are skipped, but any
            // handling (including deliberate `error` events) happens OUTSIDE the
            // catch so real server errors always propagate to the outer catch.
            let evt:
              | { type: "tool"; step: number; tool: string; arg: string }
              | { type: "tool_result"; step: number; detail: ResearchStepDetail }
              | { type: "delta"; text: string }
              | { type: "answer"; answer: string; sources: unknown[] }
              | { type: "followups"; questions: string[] }
              | { type: "error"; message: string };
            try {
              evt = JSON.parse(payload);
            } catch {
              continue;
            }
            if (evt.type === "tool") {
              const phase = evt.tool === "web_search" ? "searching" : evt.tool === "fetch_url" ? "fetching" : "planning";
              const label = evt.tool === "web_search" ? `Searching: ${evt.arg}` : evt.tool === "fetch_url" ? `Reading: ${evt.arg}` : "Planning…";
              // index === evt.step (pushed in order, so the new length-1 matches).
              pushResearchStep({ phase, label, done: false });
            } else if (evt.type === "tool_result") {
              updateResearchStep(evt.step, { detail: evt.detail, done: true });
            } else if (evt.type === "delta") {
              appendToAssistantMessage(assistantId, evt.text);
            } else if (evt.type === "answer") {
              // Deltas already streamed the answer live; record canonical text
              // + sources for the final (authoritative) update.
              answer = evt.answer;
              sources = evt.sources;
            } else if (evt.type === "followups") {
              followUps = evt.questions;
            } else if (evt.type === "error") {
              throw new Error(evt.message);
            }
          }
        }

        setStreaming(assistantId, false);
        const response = {
          query: content,
          tier: 0,
          success: true,
          answer,
          confidence: 1,
          duration_ms: Date.now() - startedAt,
          conversation_mode: true,
          agents_used: ["adaptive-research"],
          sources,
          follow_ups: followUps,
          // Persist the accumulated chain-of-thought on the message so it
          // survives reload (the live region in researchSteps is cleared below).
          research_steps: useChatStore.getState().researchSteps,
        } as unknown as QueryResponse;
        updateAssistantMessage(assistantId, response, { skipPersist: true });
        trackQuery(content, response);
      } catch (error) {
        updateAssistantMessage(assistantId, {
          query: content,
          tier: 0,
          success: false,
          answer: `Error: ${error instanceof Error ? error.message : "Something went wrong"}`,
          confidence: 0,
          duration_ms: 0,
        });
      } finally {
        setLoading(false);
        clearResearchSteps();
      }
      return;
    },
    [messages, addUserMessage, addAssistantMessage, appendToAssistantMessage, updateAssistantMessage, setLoading, setStreaming, pushResearchStep, updateResearchStep, clearResearchSteps],
  );

  return { sendMessage };
}
