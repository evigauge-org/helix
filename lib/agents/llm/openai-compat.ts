// lib/agents/llm/openai-compat.ts
//
// Adapter for any provider speaking OpenAI ChatCompletions:
// OpenAI, OpenRouter, Perplexity, Grok (xAI), Together, Groq, vLLM, Ollama,
// custom-hosted finetuned models. Reused by `kind: "managed"` (which sets
// baseUrl to OpenRouter) and by `kind: "openai_compat"` (customer-supplied).

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

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface OpenAIChatChoice {
  index: number;
  message: {
    role: "assistant";
    content: string | null;
    tool_calls?: OpenAIToolCall[];
  };
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | null;
}

interface OpenAIResponse {
  choices?: OpenAIChatChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { message?: string; code?: string };
}

function toOpenAITools(tools: ToolDef[]): unknown[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.slug,
      description: t.description,
      parameters: zodToJsonSchema(t.schema),
    },
  }));
}

function toOpenAIMessages(messages: ChatMessage[]): unknown[] {
  return messages.map((m) => {
    if (m.role === "assistant") {
      const out: Record<string, unknown> = { role: "assistant", content: m.content };
      if (m.tool_calls && m.tool_calls.length > 0) {
        out.tool_calls = m.tool_calls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        }));
      }
      return out;
    }
    if (m.role === "tool") {
      return { role: "tool", tool_call_id: m.tool_call_id, content: m.content };
    }
    return { role: m.role, content: m.content };
  });
}

function fromOpenAIToolCalls(raw: OpenAIToolCall[] | undefined): NormalizedToolCall[] {
  if (!raw) return [];
  return raw.map((tc) => {
    let parsedArgs: Record<string, unknown> = {};
    try {
      parsedArgs = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
    } catch {
      parsedArgs = { __raw: tc.function.arguments };
    }
    return { id: tc.id, name: tc.function.name, arguments: parsedArgs };
  });
}

function classifyHttp(status: number): "auth_failed" | "rate_limited" | "model_invalid" | "upstream_error" {
  if (status === 401 || status === 403) return "auth_failed";
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 404) return "model_invalid";
  return "upstream_error";
}

async function callOpenAICompat(config: LlmConfig, request: ChatRequest): Promise<OpenAIResponse> {
  const url = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const body = {
    model: config.model,
    messages: toOpenAIMessages(request.messages),
    tools: request.tools.length > 0 ? toOpenAITools(request.tools) : undefined,
    tool_choice: request.tools.length > 0 ? "auto" : undefined,
    max_tokens: request.max_tokens,
    temperature: request.temperature,
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
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

  let json: OpenAIResponse;
  try {
    json = (await res.json()) as OpenAIResponse;
  } catch (e) {
    throw new AdapterError("parse_error", `Invalid JSON: ${(e as Error).message}`);
  }
  if (json.error) {
    throw new AdapterError("upstream_error", json.error.message ?? "unknown provider error");
  }
  return json;
}

export const openaiCompatAdapter: LlmAdapter = {
  async chat(config, request): Promise<ChatResponse> {
    const json = await callOpenAICompat(config, request);
    const choice = json.choices?.[0];
    if (!choice) throw new AdapterError("parse_error", "no choices in response");
    const usage = json.usage ?? {};
    return {
      content: choice.message.content ?? null,
      tool_calls: fromOpenAIToolCalls(choice.message.tool_calls),
      usage: {
        input_tokens: usage.prompt_tokens ?? 0,
        output_tokens: usage.completion_tokens ?? 0,
        total_tokens: usage.total_tokens ?? (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0),
      },
      finish_reason:
        choice.finish_reason === "tool_calls"
          ? "tool_calls"
          : choice.finish_reason === "length"
            ? "length"
            : choice.finish_reason === "stop"
              ? "stop"
              : "error",
    };
  },

  async chatStream(config, request, onDelta, signal?: AbortSignal): Promise<ChatResponse> {
    const url = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const body = {
      model: config.model,
      messages: toOpenAIMessages(request.messages),
      tools: request.tools.length > 0 ? toOpenAITools(request.tools) : undefined,
      tool_choice: request.tools.length > 0 ? "auto" : undefined,
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      stream: true,
      stream_options: { include_usage: true },
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify(body),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000),
      });
    } catch (e) {
      throw new AdapterError("unreachable", `Failed to reach ${url}: ${(e as Error).message}`);
    }
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new AdapterError(classifyHttp(res.status), text.slice(0, 500), res.status);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    let finishReason: string | null = null;
    const toolAcc = new Map<number, { id: string; name: string; args: string }>();
    let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        let json: {
          choices?: { delta?: { content?: string; tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[] }; finish_reason?: string | null }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
          error?: { message?: string; code?: string };
        };
        try { json = JSON.parse(payload); } catch { continue; }
        if (json.error) {
          throw new AdapterError("upstream_error", (json as { error?: { message?: string } }).error?.message ?? "unknown provider error");
        }
        if (json.usage) usage = { prompt_tokens: json.usage.prompt_tokens ?? 0, completion_tokens: json.usage.completion_tokens ?? 0, total_tokens: json.usage.total_tokens ?? 0 };
        const choice = json.choices?.[0];
        if (!choice) continue;
        const delta = choice.delta ?? {};
        if (typeof delta.content === "string" && delta.content) {
          content += delta.content;
          onDelta(delta.content);
        }
        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            const e = toolAcc.get(idx) ?? { id: "", name: "", args: "" };
            if (tc.id) e.id = tc.id;
            if (tc.function?.name) e.name = tc.function.name;
            if (tc.function?.arguments) e.args += tc.function.arguments;
            toolAcc.set(idx, e);
          }
        }
        if (choice.finish_reason) finishReason = choice.finish_reason;
      }
    }
    } finally {
      reader.cancel().catch(() => {});
    }

    const tool_calls: NormalizedToolCall[] = [...toolAcc.values()]
      .filter((e) => e.name)
      .map((e) => {
        let args: Record<string, unknown> = {};
        try { args = e.args ? JSON.parse(e.args) : {}; } catch { args = { __raw: e.args }; }
        return { id: e.id || `call_${e.name}`, name: e.name, arguments: args };
      });

    return {
      content: content || null,
      tool_calls,
      usage: {
        input_tokens: usage.prompt_tokens,
        output_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens || usage.prompt_tokens + usage.completion_tokens,
      },
      finish_reason:
        finishReason === "tool_calls" ? "tool_calls"
        : finishReason === "length" ? "length"
        : finishReason === "stop" ? "stop"
        : tool_calls.length > 0 ? "tool_calls" : "stop",
    };
  },

  async testConnection(config) {
    try {
      await callOpenAICompat(config, {
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
