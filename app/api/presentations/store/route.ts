// app/api/presentations/store/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pptxStore, storePptx } from "@/lib/presentations/pptx-store";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const title = (formData.get("title") as string) ?? "Presentation";

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const { id, downloadUrl } = storePptx(buffer, title);
  return NextResponse.json({ id, downloadUrl });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const entry = pptxStore.get(id);
  if (!entry || entry.expiresAt < Date.now()) {
    return NextResponse.json({ error: "Not found or expired" }, { status: 404 });
  }

  const filename = entry.title.replace(/[^a-zA-Z0-9 ]/g, "").trim();
  return new Response(entry.buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": entry.mimeType,
      "Content-Disposition": `attachment; filename="${filename}.${entry.filenameExt}"`,
      "Cache-Control": "no-store",
    },
  });
}
