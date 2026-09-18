import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const GAMMA_API_KEY = process.env.GAMMA_API_KEY;
const GAMMA_BASE = "https://api.gamma.app/v1.0";

// GET — check if Gamma is configured
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    connected: !!GAMMA_API_KEY,
    hasKey: !!GAMMA_API_KEY,
  });
}

// POST — generate content via Gamma API
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!GAMMA_API_KEY) {
    return NextResponse.json({ error: "Gamma API key not configured" }, { status: 500 });
  }

  const body = await req.json();
  const { action } = body;

  try {
    if (action === "generate") {
      // POST /v1.0/generations
      const res = await fetch(`${GAMMA_BASE}/generations`, {
        method: "POST",
        headers: {
          "X-API-KEY": GAMMA_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputText: body.inputText,
          textMode: body.textMode ?? "generate",
          format: body.format ?? "presentation",
          numCards: body.numCards ?? 10,
          exportAs: body.exportAs ?? "pptx",
          textOptions: body.textOptions ?? {
            amount: "default",
            tone: "professional",
          },
          imageOptions: body.imageOptions ?? {
            source: "webFreeToUse",
          },
          cardOptions: body.cardOptions ?? {
            dimensions: "16x9",
          },
          additionalInstructions: body.additionalInstructions,
          themeId: body.themeId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        return NextResponse.json(
          { error: err.message ?? err.error ?? `Gamma error ${res.status}` },
          { status: res.status },
        );
      }

      return NextResponse.json(await res.json());
    }

    if (action === "poll") {
      // GET /v1.0/generations/{id}
      const res = await fetch(`${GAMMA_BASE}/generations/${body.generationId}`, {
        headers: { "X-API-KEY": GAMMA_API_KEY },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        return NextResponse.json(
          { error: err.message ?? `Gamma error ${res.status}` },
          { status: res.status },
        );
      }

      return NextResponse.json(await res.json());
    }

    if (action === "themes") {
      // GET /v1.0/themes
      const res = await fetch(`${GAMMA_BASE}/themes?limit=50`, {
        headers: { "X-API-KEY": GAMMA_API_KEY },
      });

      if (!res.ok) return NextResponse.json({ data: [] });
      return NextResponse.json(await res.json());
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("Gamma API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gamma request failed" },
      { status: 500 },
    );
  }
}
