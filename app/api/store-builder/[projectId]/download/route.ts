import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { buildCatalogXlsx } from "@/lib/store-builder/catalog";
import type { CatalogOutput } from "@/lib/store-builder/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const type = req.nextUrl.searchParams.get("type");

  const project = await prisma.storeProject.findFirst({
    where: { id: projectId, userId: session.user.id },
    include: { stages: true },
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (type === "catalog") {
    const catalogStage = project.stages.find((s) => s.name === "catalog");
    if (!catalogStage?.output) {
      return NextResponse.json({ error: "Catalog not ready" }, { status: 404 });
    }

    const output = catalogStage.output as unknown as CatalogOutput;
    const buffer = buildCatalogXlsx(output.products);

    return new Response(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="product-catalog.xlsx"',
      },
    });
  }

  return NextResponse.json({ error: "Unknown download type" }, { status: 400 });
}
