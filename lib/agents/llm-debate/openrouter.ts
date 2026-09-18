// lib/agents/llm-debate/openrouter.ts

export interface OpenRouterCallParams {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  webAccess: boolean;
  maxTokens: number;
  temperature?: number;   // default 0.5
  timeoutMs?: number;     // default 45_000
}

export type OpenRouterResult =
  | { ok: true; content: string; modelUsed: string }
  | { ok: false; status: number; error: string };

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Thin wrapper around OpenRouter chat/completions.
 * - Injects current ISO date + timestamp into the system message at call time
 *   (per feedback_dynamic_datetime_in_llm_prompts.md).
 * - Adds OpenRouter "web" plugin with Firecrawl engine when webAccess is true.
 * - 45s default timeout via AbortController.
 * - Returns a discriminated-union result instead of throwing.
 */
export async function callOpenRouter(params: OpenRouterCallParams): Promise<OpenRouterResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { ok: false, status: 0, error: "OPENROUTER_API_KEY not configured" };

  const now = new Date();
  const iso = now.toISOString();
  const datePrefix =
    `Current date (UTC): ${iso.slice(0, 10)}\n` +
    `Current timestamp (UTC): ${iso}\n` +
    `Weekday (UTC): ${now.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}\n`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: Record<string, any> = {
    model: params.model,
    messages: [
      { role: "system", content: datePrefix + "\n" + params.systemPrompt },
      { role: "user", content: params.userPrompt },
    ],
    max_tokens: params.maxTokens,
    temperature: params.temperature ?? 0.5,
  };
  if (params.webAccess) {
    body.plugins = [{ id: "web", engine: "firecrawl" }];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs ?? 45_000);

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: `OpenRouter HTTP ${res.status}: ${text.slice(0, 300)}` };
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.length === 0) {
      return { ok: false, status: res.status, error: "OpenRouter returned empty content" };
    }
    return { ok: true, content, modelUsed: params.model };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, status: 0, error: `OpenRouter call timeout after ${params.timeoutMs ?? 45_000}ms` };
    }
    return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timeout);
  }
}
