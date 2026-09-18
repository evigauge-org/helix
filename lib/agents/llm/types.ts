// lib/agents/llm/types.ts
//
// Common shapes for the per-provider adapters. Each adapter accepts a
// ChatRequest, calls the provider, and returns a normalized ChatResponse.

import type { ToolDef } from "../types";

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: NormalizedToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface NormalizedToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatRequest {
  messages: ChatMessage[];
  tools: ToolDef[];
  max_tokens: number;
  temperature: number;
}

export interface NormalizedUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface ChatResponse {
  content: string | null;
  tool_calls: NormalizedToolCall[];
  usage: NormalizedUsage;
  finish_reason: "stop" | "tool_calls" | "length" | "error";
}

export type LlmConfigKind = "managed" | "openai_compat" | "anthropic" | "gemini";

export interface LlmConfig {
  kind: LlmConfigKind;
  model: string;
  apiKey: string;
  baseUrl: string;
}

export type AdapterErrorKind =
  | "auth_failed"
  | "rate_limited"
  | "upstream_error"
  | "unreachable"
  | "model_invalid"
  | "parse_error"
  | "other";

export class AdapterError extends Error {
  constructor(
    public kind: AdapterErrorKind,
    message: string,
    public status?: number,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "AdapterError";
  }
}

export interface LlmAdapter {
  chat(config: LlmConfig, request: ChatRequest): Promise<ChatResponse>;
  chatStream?(
    config: LlmConfig,
    request: ChatRequest,
    onDelta: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<ChatResponse>;
  testConnection(config: LlmConfig): Promise<{ ok: true } | { ok: false; kind: AdapterErrorKind; message: string }>;
}
