// lib/agents/llm/gemini.ts
//
// Adapter for Google Gemini (generativelanguage.googleapis.com/v1beta).
// Gemini uses `contents` (each with `parts`), `systemInstruction`, and
// `functionDeclarations` for tools. Tool calls are `functionCall` parts;
// tool results are `functionResponse` parts.

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

interface GeminiTextPart { text: string }
interface GeminiFunctionCallPart { functionCall: { name: string; args: Record<string, unknown> } }
interface GeminiFunctionResponsePart { functionResponse: { name: string; response: { content: string } } }
type GeminiPart = GeminiTextPart | GeminiFunctionCallPart | GeminiFunctionResponsePart;

interface GeminiContent { role: "user" | "model"; parts: GeminiPart[] }

interface GeminiResponse {
  candidates?: Array<{
    content: { role: "model"; parts: GeminiPart[] };
    finishReason: "STOP" | "MAX_TOKENS" | "SAFETY" | "RECITATION" | "OTHER" | string;
  }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  error?: { code: number; message: string; status: string };
}

function toGeminiTools(tools: ToolDef[]): unknown[] | undefined {
  if (tools.length === 0) return undefined;
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.slug,
        description: t.description,
        parameters: zodToJsonSchema(t.schema),
      })),
    },
  ];
}

function toGeminiContents(messages: ChatMessage[]): { systemInstruction: { parts: GeminiTextPart[] } | undefined; contents: GeminiContent[] } {
  const systems: string[] = [];
  const contents: GeminiContent[] = [];
  // We track tool_use_id → name mapping so when we see a `tool` role we can
  // pair the result with the original function name.
  const toolCallNames = new Map<string, string>();

  for (const m of messages) {
    if (m.role === "system") {
      systems.push(m.content);
      continue;
    }
    if (m.role === "user") {
      contents.push({ role: "user", parts: [{ text: m.content }] });
      continue;
    }
    if (m.role === "assistant") {
      const parts: GeminiPart[] = [];
      if (m.content) parts.push({ text: m.content });
      if (m.tool_calls) {
        for (const tc of m.tool_calls) {
          parts.push({ functionCall: { name: tc.name, args: tc.arguments } });
          toolCallNames.set(tc.id, tc.name);
        }
      }
      contents.push({ role: "model", parts });
      continue;
    }
    if (m.role === "tool") {
      const name = toolCallNames.get(m.tool_call_id) ?? "unknown_tool";
      contents.push({
        role: "user",
        parts: [{ functionResponse: { name, response: { content: m.content } } }],
      });
    }
  }

  const systemInstruction = systems.length > 0 ? { parts: [{ text: systems.join("\n\n") }] } : undefined;
  return { systemInstruction, contents };
}

function fromGeminiParts(parts: GeminiPart[]): { content: string | null; tool_calls: NormalizedToolCall[] } {
  let text = "";
  const tool_calls: NormalizedToolCall[] = [];
  let counter = 0;
  for (const p of parts) {
    if ("text" in p) text += p.text;
    else if ("functionCall" in p) {
      // Gemini doesn't provide a tool-call id; synthesize one.
      tool_calls.push({
        id: `gem_${Date.now()}_${counter++}`,
        name: p.functionCall.name,
        arguments: p.functionCall.args ?? {},
      });
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

async function callGemini(config: LlmConfig, request: ChatRequest): Promise<GeminiResponse> {
  const base = config.baseUrl?.replace(/\/$/, "") || "https://generativelanguage.googleapis.com";
  const url = `${base}/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
  const { systemInstruction, contents } = toGeminiContents(request.messages);
  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: request.max_tokens,
      temperature: request.temperature,
    },
  };
  if (systemInstruction) body.systemInstruction = systemInstruction;
  const tools = toGeminiTools(request.tools);
  if (tools) body.tools = tools;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  let json: GeminiResponse;
  try {
    json = (await res.json()) as GeminiResponse;
  } catch (e) {
    throw new AdapterError("parse_error", `Invalid JSON: ${(e as Error).message}`);
  }
  if (json.error) {
    throw new AdapterError(classifyHttp(json.error.code), json.error.message, json.error.code);
  }
  return json;
}

export const geminiAdapter: LlmAdapter = {
  async chat(config, request): Promise<ChatResponse> {
    const json = await callGemini(config, request);
    const cand = json.candidates?.[0];
    if (!cand) throw new AdapterError("parse_error", "no candidates in Gemini response");
    const { content, tool_calls } = fromGeminiParts(cand.content.parts);
    const usage = json.usageMetadata ?? {};
    return {
      content,
      tool_calls,
      usage: {
        input_tokens: usage.promptTokenCount ?? 0,
        output_tokens: usage.candidatesTokenCount ?? 0,
        total_tokens: usage.totalTokenCount ?? 0,
      },
      finish_reason:
        tool_calls.length > 0
          ? "tool_calls"
          : cand.finishReason === "MAX_TOKENS"
            ? "length"
            : cand.finishReason === "STOP"
              ? "stop"
              : "error",
    };
  },

  async testConnection(config) {
    try {
      await callGemini(config, {
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
