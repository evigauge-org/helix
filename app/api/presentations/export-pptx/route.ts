import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { buildPptxBuffer } from "@/lib/presentations/build-pptx";
import type { DeckStructure } from "@/lib/slide-types";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { deck } = await req.json();
  if (!deck) return NextResponse.json({ error: "Deck required" }, { status: 400 });

  try {
    const buffer = await buildPptxBuffer(deck as DeckStructure);
    const filename = (deck.title ?? "presentation").replace(/[^a-zA-Z0-9 ]/g, "").trim();
    return new Response(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${filename}.pptx"`,
      },
    });
  } catch (error) {
    console.error("PPTX export error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export PPTX" },
      { status: 500 },
    );
  }
}
