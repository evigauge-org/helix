// lib/research/adaptive-agent.ts
import { dispatchChat, dispatchChatStream } from "@/lib/agents/llm/dispatch";
import type { ChatMessage, LlmConfig } from "@/lib/agents/llm/types";
import type { ToolContext } from "@/lib/agents/types";
import { buildResearchTools, type Source } from "./tools";
import { getAdaptiveResearchPrompt } from "./adaptive-prompt";
import type { ResearchProgress, ResearchStepDetail } from "@/lib/types";

export type AdaptiveEvent =
  | { type: "tool"; step: number; tool: string; arg: string }
  | { type: "tool_result"; step: number; detail: ResearchStepDetail }
  | { type: "delta"; text: string }
  | { type: "answer"; answer: string; sources: Source[] }
  | { type: "followups"; questions: string[] }
  | { type: "error"; message: string };

const STEP_CAP = 24;
const STUB_CTX: ToolContext = {
  userId: "research",
  agentId: "adaptive",
  runId: "adaptive",
  tickNumber: 0,
  log: () => {},
};

export function parseFollowups(text: string): string[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[0]);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string").slice(0, 3) : [];
  } catch {
    return [];
  }
}

async function generateFollowups(
  config: LlmConfig,
  query: string,
  answer: string,
  signal?: AbortSignal,
): Promise<string[]> {
  if (signal?.aborted) return [];
  try {
    const res = await dispatchChat(config, {
      messages: [
        {
          role: "system",
          content:
            "Generate exactly 3 concise follow-up questions (max 12 words each) that explore aspects not yet covered. Return ONLY a JSON array of 3 strings, nothing else.",
        },
        { role: "user", content: `Question: ${query}\n\nAnswer: ${answer.slice(0, 4000)}` },
      ],
      tools: [],
      max_tokens: 256,
      temperature: 0.7,
    });
    return parseFollowups(res.content ?? "");
  } catch {
    return [];
  }
}

export async function runAdaptiveResearch(opts: {
  query: string;
  history: ChatMessage[];
  config: LlmConfig;
  emit: (e: AdaptiveEvent) => void;
  signal?: AbortSignal;
}): Promise<{ answer: string; sources: Source[]; followups: string[]; steps: ResearchProgress[] }> {
  const { query, history, config, emit, signal } = opts;
  const { tools, getSources } = buildResearchTools();
  const toolBySlug = new Map(tools.map((t) => [t.slug, t]));

  const messages: ChatMessage[] = [
    { role: "system", content: getAdaptiveResearchPrompt(new Date()) },
    ...history,
    { role: "user", content: query },
  ];

  // Accumulated steps (with their real result detail) for persistence on the
  // assistant message, so the chain-of-thought survives reload.
  const steps: ResearchProgress[] = [];
  let stepIdx = 0;

  let answer = "";
  for (let step = 0; step < STEP_CAP; step++) {
    if (signal?.aborted) throw new Error("aborted");
    // Stream this step. On tool-calling steps content deltas are usually empty
    // (the model goes straight to tool calls); on the final step the deltas ARE
    // the answer streaming live token-by-token.
    const res = await dispatchChatStream(
      config,
      { messages, tools, max_tokens: 2048, temperature: 0.4 },
      (text) => emit({ type: "delta", text }),
      signal,
    );

    if (res.finish_reason !== "tool_calls" || res.tool_calls.length === 0) {
      answer = res.content ?? "";
      break;
    }

    messages.push({ role: "assistant", content: res.content, tool_calls: res.tool_calls });
    for (const tc of res.tool_calls) {
      const arg =
        typeof tc.arguments.query === "string"
          ? tc.arguments.query
          : typeof tc.arguments.url === "string"
            ? tc.arguments.url
            : "";
      const idx = stepIdx;
      emit({ type: "tool", step: idx, tool: tc.name, arg });

      const tool = toolBySlug.get(tc.name);
      let result;
      if (!tool) {
        result = { ok: false as const, error: `unknown tool ${tc.name}` };
      } else {
        const parsed = tool.schema.safeParse(tc.arguments);
        result = parsed.success
          ? await tool.execute(STUB_CTX, parsed.data)
          : { ok: false as const, error: "invalid tool arguments" };
      }
      messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });

      // Build the expandable detail from the REAL tool result.
      const detail = buildStepDetail(tc.name, tc.arguments, result);
      emit({ type: "tool_result", step: idx, detail });

      const phase: ResearchProgress["phase"] =
        tc.name === "web_search" ? "searching" : tc.name === "fetch_url" ? "fetching" : "planning";
      const label =
        tc.name === "web_search"
          ? `Searching: ${arg}`
          : tc.name === "fetch_url"
            ? `Reading: ${arg}`
            : "Planning…";
      steps.push({ phase, label, detail, done: true });
      stepIdx++;
    }
  }

  const sources = getSources();
  if (!answer) {
    answer =
      "I couldn't fully complete the research within the step limit. Sources gathered: " +
      sources.map((s) => `[${s.index}] ${s.title}`).join("; ");
  }
  emit({ type: "answer", answer, sources });

  const followups = await generateFollowups(config, query, answer, signal);
  emit({ type: "followups", questions: followups });

  return { answer, sources, followups, steps };
}

// Map a tool's raw result into the expandable step detail shape.
//   web_search → { ok, data: { results: [{ index, title, url, snippet }] } }
//   fetch_url  → { ok, data: { title, text, length } }
//   todo_write → { ok, data: { completedCount, totalCount } } (detail uses the call's tasks arg)
//   failure    → { ok: false, error }
function buildStepDetail(
  toolName: string,
  args: Record<string, unknown>,
  result: { ok: boolean; data?: unknown; error?: string },
): ResearchStepDetail {
  if (!result.ok) {
    return { kind: "error", message: result.error ?? "tool failed" };
  }
  if (toolName === "web_search") {
    const data = result.data as { results?: { title?: string; url?: string }[] } | undefined;
    const results = (data?.results ?? []).map((r) => ({
      title: r.title ?? r.url ?? "",
      url: r.url ?? "",
    }));
    return { kind: "search", results };
  }
  if (toolName === "fetch_url") {
    const data = result.data as { title?: string; text?: string } | undefined;
    return {
      kind: "fetch",
      title: data?.title ?? "",
      excerpt: String(data?.text ?? "").slice(0, 600),
    };
  }
  if (toolName === "todo_write") {
    const tasks = Array.isArray((args as { tasks?: unknown }).tasks)
      ? ((args as { tasks: { task: string; done: boolean }[] }).tasks)
      : [];
    return { kind: "todo", tasks };
  }
  // Unknown successful tool — represent as an empty fetch-style detail.
  return { kind: "fetch", title: toolName, excerpt: "" };
}
