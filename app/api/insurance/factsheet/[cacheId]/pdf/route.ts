// app/api/insurance/factsheet/[cacheId]/pdf/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ cacheId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { cacheId } = await params;
  const row = await prisma.insuranceFactsheetCache.findUnique({ where: { id: cacheId } });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const filename = `${row.insurerSlug}_${row.monthYyyymm}.pdf`;
  return new NextResponse(new Uint8Array(row.pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(row.pdfBytes.byteLength),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
