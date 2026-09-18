import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatMessage, QueryResponse, ResearchProgress } from "@/lib/types";

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  researchSteps: ResearchProgress[];
  sessionsLoaded: boolean;

  loadSessions: () => Promise<void>;
  newChat: () => void;
  switchSession: (sessionId: string) => Promise<void>;

  addUserMessage: (content: string, files?: ChatMessage["files"], opts?: { skipPersist?: boolean }) => string;
  addAssistantMessage: (id: string, opts?: { mode?: "casual" | "research" }) => void;
  appendToAssistantMessage: (id: string, chunk: string) => void;
  updateAssistantMessage: (id: string, response: QueryResponse, opts?: { skipPersist?: boolean }) => void;
  setStreaming: (id: string, streaming: boolean) => void;
  pushResearchStep: (step: ResearchProgress) => void;
  updateResearchStep: (step: number, patch: Partial<ResearchProgress>) => void;
  clearResearchSteps: () => void;
  setLoading: (loading: boolean) => void;
  setActiveSession: (sessionId: string | null) => void;
  clearMessages: () => void;
}

function generateTitle(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length <= 40) return trimmed;
  return trimmed.slice(0, 40) + "...";
}

export function rehydrateMessageResponse(
  role: string,
  content: string,
  metadata: unknown,
): QueryResponse | undefined {
  if (role !== "assistant") return undefined;
  if (!metadata || typeof metadata !== "object") return undefined;
  const md = metadata as Partial<QueryResponse>;
  const tier = typeof md.tier === "number" ? md.tier : 0;
  const conversationMode =
    typeof md.conversation_mode === "boolean" ? md.conversation_mode : tier <= 1;
  return {
    query: md.query ?? "",
    tier,
    success: md.success ?? true,
    answer: md.answer ?? content,
    confidence: md.confidence ?? 0,
    duration_ms: md.duration_ms ?? 0,
    ...md,
    conversation_mode: conversationMode,
  } as QueryResponse;
}

// Shared buffer for coalesced streaming chunks — module-scoped so multiple
// set() calls from the zustand store's appendToAssistantMessage can enqueue
// into the same pending map without racing.
const pendingAppends = new Map<string, string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function drainPendingInto<T extends { id: string; content: string }>(
  targetId: string,
  messages: T[],
): T[] {
  const pending = pendingAppends.get(targetId);
  if (!pending) return messages;
  pendingAppends.delete(targetId);
  return messages.map((m) => (m.id === targetId ? { ...m, content: m.content + pending } : m));
}

// Save message to DB (fire and forget)
function saveMessageToDB(sessionId: string, role: string, content: string, metadata?: unknown) {
  fetch(`/api/chat-sessions/${sessionId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, content, metadata }),
  }).catch(() => {});
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      messages: [],
      isLoading: false,
      researchSteps: [],
      sessionsLoaded: false,

      loadSessions: async () => {
        try {
          const res = await fetch("/api/chat-sessions");
          if (!res.ok) return;
          const data = await res.json();
          const dbSessions: ChatSession[] = (data.sessions ?? []).map((s: { id: string; title: string; createdAt: string; updatedAt: string }) => ({
            id: s.id,
            title: s.title ?? "Untitled",
            messages: [],
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
          }));

          // Merge: keep local sessions not in DB, add DB sessions
          const state = get();
          const localIds = new Set(state.sessions.map((s) => s.id));
          const merged = [
            ...state.sessions,
            ...dbSessions.filter((s) => !localIds.has(s.id)),
          ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

          set({ sessions: merged, sessionsLoaded: true });
        } catch {
          set({ sessionsLoaded: true });
        }
      },

      newChat: () => {
        set({ messages: [], activeSessionId: null, researchSteps: [] });
      },

      switchSession: async (sessionId) => {
        // Load messages from DB
        try {
          const res = await fetch(`/api/chat-sessions/${sessionId}/messages`);
          if (res.ok) {
            const data = await res.json();
            const messages: ChatMessage[] = (data.messages ?? []).map(
              (m: { id: string; role: string; content: string; metadata: unknown; createdAt: string }) => ({
                id: m.id,
                role: m.role as "user" | "assistant",
                content: m.content,
                response: rehydrateMessageResponse(m.role, m.content, m.metadata),
                createdAt: m.createdAt,
              }),
            );
            set({ activeSessionId: sessionId, messages, researchSteps: [] });
            return;
          }
        } catch { /* fall through to local */ }

        // Fallback: load from local store
        const target = get().sessions.find((s) => s.id === sessionId);
        if (target) {
          set({ activeSessionId: sessionId, messages: target.messages, researchSteps: [] });
        }
      },

      addUserMessage: (content, files, opts) => {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const skipPersist = !!opts?.skipPersist;

        set((state) => {
          let { activeSessionId, sessions } = state;

          if (!activeSessionId) {
            activeSessionId = crypto.randomUUID();
            sessions = [
              { id: activeSessionId, title: generateTitle(content), messages: [], createdAt: now, updatedAt: now },
              ...sessions,
            ];

            // Create session in DB
            fetch("/api/chat-sessions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: generateTitle(content) }),
            })
              .then((r) => r.json())
              .then((data) => {
                if (data.session?.id) {
                  // Update local session ID to match DB
                  const dbId = data.session.id;
                  set((s) => ({
                    activeSessionId: dbId,
                    sessions: s.sessions.map((sess) =>
                      sess.id === activeSessionId ? { ...sess, id: dbId } : sess
                    ),
                  }));
                  // Save the user message with DB session ID (unless caller persists server-side)
                  if (!skipPersist) saveMessageToDB(dbId, "user", content);
                }
              })
              .catch(() => {});
          } else {
            // Save message to DB (unless caller persists server-side)
            if (!skipPersist) saveMessageToDB(activeSessionId, "user", content);
          }

          const newMessages = [
            ...state.messages,
            { id, role: "user" as const, content, files, createdAt: now },
          ];

          return {
            activeSessionId,
            sessions: sessions.map((sess) =>
              sess.id === activeSessionId
                ? { ...sess, messages: newMessages, updatedAt: now }
                : sess
            ),
            messages: newMessages,
          };
        });
        return id;
      },

      addAssistantMessage: (id, opts) => {
        set((state) => ({
          messages: [
            ...state.messages,
            {
              id,
              role: "assistant" as const,
              content: "",
              isStreaming: true,
              mode: opts?.mode ?? "research",
              createdAt: new Date().toISOString(),
            },
          ],
        }));
      },

      appendToAssistantMessage: (id, chunk) => {
        // Buffer chunks and flush on an interval to avoid re-parsing the full
        // markdown+running React reconciliation on every SSE delta (which can
        // OOM the renderer on long streams — "Aw, Snap" tab crash).
        const FLUSH_MS = 120;
        pendingAppends.set(id, (pendingAppends.get(id) ?? "") + chunk);
        if (flushTimer !== null) return;
        flushTimer = setTimeout(() => {
          flushTimer = null;
          if (pendingAppends.size === 0) return;
          const patches = Array.from(pendingAppends.entries());
          pendingAppends.clear();
          set((state) => ({
            messages: state.messages.map((m) => {
              const entry = patches.find(([mid]) => mid === m.id);
              return entry ? { ...m, content: m.content + entry[1] } : m;
            }),
          }));
        }, FLUSH_MS);
      },

      updateAssistantMessage: (id, response, opts) => {
        const state = get();

        // Save assistant message to DB — include full response for reload.
        // The OpenRouter casual-chat lane passes skipPersist because the server
        // /api/chat/stream route already wrote the assistant row server-side.
        if (state.activeSessionId && !opts?.skipPersist) {
          saveMessageToDB(state.activeSessionId, "assistant", response.answer, response);
        }

        // Drop any pending chunks for this id — response.answer is authoritative.
        pendingAppends.delete(id);

        set((s) => {
          const updatedMessages = s.messages.map((m) =>
            m.id === id ? { ...m, content: response.answer, response, isStreaming: false } : m
          );
          const updatedSessions = s.sessions.map((sess) =>
            sess.id === s.activeSessionId
              ? { ...sess, messages: updatedMessages, updatedAt: new Date().toISOString() }
              : sess
          );
          return { messages: updatedMessages, sessions: updatedSessions };
        });
      },

      setStreaming: (id, streaming) => {
        set((state) => {
          // If stream is ending, drain any pending chunks into content now so
          // nothing gets stranded in the buffer past isStreaming=false.
          const drained = streaming ? state.messages : drainPendingInto(id, state.messages);
          return {
            messages: drained.map((m) =>
              m.id === id ? { ...m, isStreaming: streaming } : m
            ),
          };
        });
      },

      pushResearchStep: (step) => set((s) => ({ researchSteps: [...s.researchSteps, step] })),
      updateResearchStep: (step, patch) =>
        set((s) => ({
          researchSteps: s.researchSteps.map((st, i) => (i === step ? { ...st, ...patch } : st)),
        })),
      clearResearchSteps: () => set({ researchSteps: [] }),
      setLoading: (isLoading) => set({ isLoading }),
      setActiveSession: (activeSessionId) => set({ activeSessionId }),
      clearMessages: () => set({ messages: [], researchSteps: [] }),
    }),
    {
      name: "helix-chat",
      partialize: (state) => ({
        sessions: state.sessions,
        activeSessionId: state.activeSessionId,
        messages: state.messages,
      }),
    },
  ),
);
