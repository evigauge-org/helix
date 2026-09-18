import { SESSION_SUMMARY_PROMPT, FACT_EXTRACTION_PROMPT } from "./prompts";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemma-4-26b-a4b-it";

async function aiCall(prompt: string, maxTokens: number, temperature: number): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      temperature,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter failed: ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

export async function summarizeSession(transcript: string): Promise<string> {
  return (await aiCall(SESSION_SUMMARY_PROMPT(transcript), 400, 0.3)).trim();
}

export type ExtractedFact = {
  fact: string;
  category: "identity" | "preference" | "project" | "context";
  confidence: number;
};

export async function extractFacts(
  transcript: string,
  existingFacts: string[],
): Promise<ExtractedFact[]> {
  const raw = await aiCall(FACT_EXTRACTION_PROMPT(transcript, existingFacts), 600, 0.2);
  const cleaned = raw.replace(/```json?/g, "").replace(/```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f) =>
        typeof f?.fact === "string" &&
        ["identity", "preference", "project", "context"].includes(f.category) &&
        typeof f.confidence === "number",
    );
  } catch {
    return [];
  }
}

export function buildTranscript(
  messages: { role: string; content: string }[],
): string {
  return messages.map((m) => `${m.role}: ${m.content}`).join("\n");
}
