// lib/presentations/generate-deck.ts
import { WINSTON_PROMPT, type DeckStructure } from "@/lib/slide-types";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

export async function generateDeck(
  topic: string,
  opts?: { sourceText?: string },
): Promise<DeckStructure> {
  if (!OPENROUTER_API_KEY) throw new Error("OpenRouter not configured");

  // Project convention: every LLM call site injects the current date + ISO
  // timestamp so the model doesn't rely on its training cutoff for any
  // "latest"/"today"/"this quarter" reasoning.
  const now = new Date();
  const dateLine = `Current date (use this for any "latest"/"today"/"this quarter" reasoning): ${now.toISOString().slice(0, 10)} (ISO ${now.toISOString()})`;

  const sourceBlock = opts?.sourceText
    ? `\n\nUse the following source material from the prior conversation as the primary basis for the deck. Ground every slide in this content; do not invent facts not supported by it.\n\n<source>\n${opts.sourceText}\n</source>`
    : "";

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemma-3-27b-it",
      messages: [
        { role: "system", content: dateLine },
        { role: "system", content: WINSTON_PROMPT },
        {
          role: "user",
          content: `Create a professional, content-rich slide deck about: ${topic}. Use Patrick Winston's framework strictly — empowerment promise, 3 heuristics, evidence, cycle, contribution, no "thank you".${sourceBlock}`,
        },
      ],
      max_tokens: 4096,
      temperature: 0.7,
    }),
  });

  if (!res.ok) throw new Error("AI generation failed");
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "";
  const jsonStr = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  return JSON.parse(jsonStr);
}
