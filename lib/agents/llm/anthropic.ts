// lib/agents/llm/anthropic.ts
//
// Adapter for Anthropic Messages API (api.anthropic.com).
// Translates the common ChatRequest into Anthropic's "system + messages with
// content blocks" shape, and translates `tool_use` blocks back into our
// NormalizedToolCall list.

import { zodToJsonSchema } from "@/lib/agents/runner-helpers";
import type { ToolDef } from "../types";
import {
  AdapterError,
  type ChatMessage,
  type ChatRequest,
  type ChatResponse,
  type LlmAdapter,
  type LlmConfig,
  type NormalizedToolCall,
} from "./types";

const ANTHROPIC_VERSION = "2023-06-01";

interface AnthropicTextBlock { type: "text"; text: string }
interface AnthropicToolUseBlock { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
interface AnthropicToolResultBlock { type: "tool_result"; tool_use_id: string; content: string }
type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock | AnthropicToolResultBlock;

interface AnthropicResponse {
  content: AnthropicContentBlock[];
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use";
  usage: { input_tokens: number; output_tokens: number };
  error?: { type: string; message: string };
}

function toAnthropicTools(tools: ToolDef[]): unknown[] {
  return tools.map((t) => ({
    name: t.slug,
    description: t.description,
    input_schema: zodToJsonSchema(t.schema),
  }));
}

interface AnthropicMessageOut {
  role: "user" | "assistant";
  content: AnthropicContentBlock[];
}

function toAnthropicMessages(messages: ChatMessage[]): { system: string; messages: AnthropicMessageOut[] } {
  // Anthropic wants `system` as a top-level string. Concatenate any system messages.
  const systems: string[] = [];
  const out: AnthropicMessageOut[] = [];

  // We need to fold consecutive `tool` messages into the next assistant turn's preceding `user` block.
  // Anthropic shape: assistant emits tool_use blocks, then NEXT user message contains tool_result blocks.
  let pendingToolResults: AnthropicToolResultBlock[] = [];

  const flushToolResults = () => {
    if (pendingToolResults.length === 0) return;
    out.push({ role: "user", content: pendingToolResults });
    pendingToolResults = [];
  };

  for (const m of messages) {
    if (m.role === "system") {
      systems.push(m.content);
      continue;
    }
    if (m.role === "tool") {
      pendingToolResults.push({ type: "tool_result", tool_use_id: m.tool_call_id, content: m.content });
      continue;
    }
    flushToolResults();
    if (m.role === "user") {
      out.push({ role: "user", content: [{ type: "text", text: m.content }] });
    } else {
      const blocks: AnthropicContentBlock[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      if (m.tool_calls) {
        for (const tc of m.tool_calls) {
          blocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.arguments });
        }
      }
      out.push({ role: "assistant", content: blocks });
    }
  }
  flushToolResults();

  return { system: systems.join("\n\n"), messages: out };
}

function fromAnthropicContent(blocks: AnthropicContentBlock[]): { content: string | null; tool_calls: NormalizedToolCall[] } {
  let text = "";
  const tool_calls: NormalizedToolCall[] = [];
  for (const b of blocks) {
    if (b.type === "text") text += b.text;
    else if (b.type === "tool_use") {
      tool_calls.push({ id: b.id, name: b.name, arguments: b.input });
    }
  }
  return { content: text.length > 0 ? text : null, tool_calls };
}

function classifyHttp(status: number): "auth_failed" | "rate_limited" | "model_invalid" | "upstream_error" {
  if (status === 401 || status === 403) return "auth_failed";
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 404) return "model_invalid";
  return "upstream_error";
}

async function callAnthropic(config: LlmConfig, request: ChatRequest): Promise<AnthropicResponse> {
  const base = config.baseUrl?.replace(/\/$/, "") || "https://api.anthropic.com";
  const url = `${base}/v1/messages`;
  const { system, messages } = toAnthropicMessages(request.messages);
  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: request.max_tokens,
    temperature: request.temperature,
    messages,
  };
  if (system) body.system = system;
  if (request.tools.length > 0) body.tools = toAnthropicTools(request.tools);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    throw new AdapterError("unreachable", `Failed to reach ${url}: ${(e as Error).message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AdapterError(classifyHttp(res.status), text.slice(0, 500), res.status);
  }

  let json: AnthropicResponse;
  try {
    json = (await res.json()) as AnthropicResponse;
  } catch (e) {
    throw new AdapterError("parse_error", `Invalid JSON: ${(e as Error).message}`);
  }
  if (json.error) {
    throw new AdapterError("upstream_error", json.error.message);
  }
  return json;
}

export const anthropicAdapter: LlmAdapter = {
  async chat(config, request): Promise<ChatResponse> {
    const json = await callAnthropic(config, request);
    const { content, tool_calls } = fromAnthropicContent(json.content);
    return {
      content,
      tool_calls,
      usage: {
        input_tokens: json.usage.input_tokens,
        output_tokens: json.usage.output_tokens,
        total_tokens: json.usage.input_tokens + json.usage.output_tokens,
      },
      finish_reason:
        json.stop_reason === "tool_use"
          ? "tool_calls"
          : json.stop_reason === "max_tokens"
            ? "length"
            : json.stop_reason === "end_turn" || json.stop_reason === "stop_sequence"
              ? "stop"
              : "error",
    };
  },

  async testConnection(config) {
    try {
      await callAnthropic(config, {
        messages: [{ role: "user", content: "ping" }],
        tools: [],
        max_tokens: 1,
        temperature: 0,
      });
      return { ok: true };
    } catch (e) {
      const err = e as AdapterError;
      return { ok: false, kind: err.kind ?? "other", message: err.message };
    }
  },
};
