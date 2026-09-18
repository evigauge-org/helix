// app/api/store-builder/clarifier-schema/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { z } from "zod";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const schema = z.object({ customType: z.string().min(3).max(200) });

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!OPENROUTER_API_KEY) return NextResponse.json({ error: "OpenRouter not configured" }, { status: 500 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 400 });

  const now = new Date();
  const datePrefix = `Current date: ${now.toISOString().slice(0, 10)} (ISO ${now.toISOString()}). Use this for any "latest"/"current" reasoning.`;

  const prompt = `${datePrefix}

A user wants to build a brand around: "${parsed.data.customType}".

Generate two multi-select pill groups for a brand-clarifier form. Return ONLY JSON:
{
  "nichePills":   { "label": "Niche / sub-category", "options": ["...", "..."] },
  "productPills": { "label": "Main products / offerings", "options": ["...", "..."] }
}

Rules:
- 6-10 options in each group, short (1-3 words each)
- Use the vocabulary a real business owner in this space would use
- Avoid generic words like "various", "other", "miscellaneous"`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemma-3-27b-it",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
      temperature: 0.5,
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: `OpenRouter returned HTTP ${res.status}` }, { status: 502 });
  }
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "";
  const jsonStr = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();

  try {
    const parsedSchema = JSON.parse(jsonStr) as {
      nichePills: { label: string; options: string[] };
      productPills: { label: string; options: string[] };
    };
    if (
      !Array.isArray(parsedSchema?.nichePills?.options) ||
      !Array.isArray(parsedSchema?.productPills?.options)
    ) {
      throw new Error("invalid shape");
    }
    return NextResponse.json(parsedSchema);
  } catch {
    return NextResponse.json(
      { error: "Could not auto-generate fields for that category. Please pick one of the first-class categories or enter niche + products manually." },
      { status: 502 },
    );
  }
}
