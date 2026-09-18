// app/api/presentations/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { generateDeck } from "@/lib/presentations/generate-deck";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { topic, sourceText } = await req.json();
  if (!topic) return NextResponse.json({ error: "Topic required" }, { status: 400 });

  try {
    const deck = await generateDeck(topic, { sourceText });
    return NextResponse.json({ deck });
  } catch (error) {
    console.error("Presentation generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate presentation" },
      { status: 500 },
    );
  }
}
