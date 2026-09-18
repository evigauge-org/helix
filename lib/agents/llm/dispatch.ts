// lib/agents/llm/dispatch.ts
//
// Routes a ChatRequest to the correct adapter and resolves an Agent's
// runtime LlmConfig (managed fallback OR per-user provider with decrypted key).

import { prisma } from "@/lib/prisma";
import { decryptKey } from "@/lib/crypto/llm-provider-keys";
import { openaiCompatAdapter } from "./openai-compat";
import { anthropicAdapter } from "./anthropic";
import { geminiAdapter } from "./gemini";
import type { ChatRequest, ChatResponse, LlmAdapter, LlmConfig } from "./types";

const DEFAULT_MANAGED_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MANAGED_MODEL = "anthropic/claude-haiku-4.5";
const DEFAULT_ANTHROPIC_BASE = "https://api.anthropic.com";
const DEFAULT_GEMINI_BASE = "https://generativelanguage.googleapis.com";

function adapterFor(kind: LlmConfig["kind"]): LlmAdapter {
  switch (kind) {
    case "managed":
    case "openai_compat":
      return openaiCompatAdapter;
    case "anthropic":
      return anthropicAdapter;
    case "gemini":
      return geminiAdapter;
  }
}

export async function dispatchChat(config: LlmConfig, request: ChatRequest): Promise<ChatResponse> {
  return adapterFor(config.kind).chat(config, request);
}

export async function dispatchChatStream(
  config: LlmConfig,
  request: ChatRequest,
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const adapter = adapterFor(config.kind);
  if (adapter.chatStream) return adapter.chatStream(config, request, onDelta, signal);
  // Graceful degrade for adapters without streaming (anthropic/gemini): one chunk.
  const res = await adapter.chat(config, request);
  if (res.content) onDelta(res.content);
  return res;
}

export async function dispatchTest(config: LlmConfig) {
  return adapterFor(config.kind).testConnection(config);
}

export async function resolveAgentLlmConfig(agent: {
  runnerProviderId: string | null;
  runnerModel: string | null;
}): Promise<LlmConfig> {
  if (!agent.runnerProviderId) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("Managed runner requires OPENROUTER_API_KEY env var");
    }
    return {
      kind: "managed",
      apiKey,
      baseUrl: DEFAULT_MANAGED_BASE_URL,
      model: agent.runnerModel || DEFAULT_MANAGED_MODEL,
    };
  }

  const provider = await prisma.llmProvider.findUnique({ where: { id: agent.runnerProviderId } });
  if (!provider) throw new Error(`Provider ${agent.runnerProviderId} not found`);

  const apiKey = decryptKey({
    iv: provider.apiKeyIv,
    authTag: provider.apiKeyAuthTag,
    ciphertext: provider.apiKeyCipher,
  });

  const baseUrl =
    provider.baseUrl ??
    (provider.kind === "anthropic"
      ? DEFAULT_ANTHROPIC_BASE
      : provider.kind === "gemini"
        ? DEFAULT_GEMINI_BASE
        : "");

  if (!baseUrl) {
    throw new Error(`Provider ${provider.id} has kind=openai_compat but no baseUrl`);
  }

  return {
    kind: provider.kind as LlmConfig["kind"],
    apiKey,
    baseUrl,
    model: agent.runnerModel || provider.defaultModel || "",
  };
}

export function configForUnsavedProvider(input: {
  kind: "openai_compat" | "anthropic" | "gemini";
  baseUrl?: string | null;
  apiKey: string;
  model: string;
}): LlmConfig {
  const baseUrl =
    input.baseUrl ??
    (input.kind === "anthropic"
      ? DEFAULT_ANTHROPIC_BASE
      : input.kind === "gemini"
        ? DEFAULT_GEMINI_BASE
        : "");
  return { kind: input.kind, apiKey: input.apiKey, baseUrl, model: input.model };
}
