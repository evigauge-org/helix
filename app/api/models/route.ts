import { NextResponse } from "next/server";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Models used by Helix backend
const HELIX_MODELS = [
  "google/gemma-3-27b-it",
  "openai/gpt-4o",
  "anthropic/claude-opus-4-6",
  "google/gemini-2.5-flash-preview",
  "deepseek/deepseek-r1",
];

export async function GET() {
  if (!OPENROUTER_API_KEY) {
    return NextResponse.json({ models: [] });
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}` },
      next: { revalidate: 3600 }, // cache for 1 hour
    });

    if (!res.ok) {
      return NextResponse.json({ models: [] });
    }

    const data = await res.json();
    const allModels = data.data ?? [];

    // Filter to Helix models and extract pricing
    const models = HELIX_MODELS.map((id) => {
      const model = allModels.find((m: { id: string }) => m.id === id);
      if (!model) return { id, name: id.split("/")[1], prompt: 0, completion: 0 };
      return {
        id: model.id,
        name: model.name ?? id.split("/")[1],
        prompt: parseFloat(model.pricing?.prompt ?? "0") * 1_000_000, // per 1M tokens
        completion: parseFloat(model.pricing?.completion ?? "0") * 1_000_000,
      };
    });

    return NextResponse.json({ models });
  } catch {
    return NextResponse.json({ models: [] });
  }
}
