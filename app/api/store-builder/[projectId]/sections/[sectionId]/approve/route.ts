// app/api/store-builder/[projectId]/sections/[sectionId]/approve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { SectionVersion } from "@/lib/store-builder/types";

const body = z.object({ stageId: z.string(), versionId: z.string() });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; sectionId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { projectId, sectionId } = await params;
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 400 });

  const project = await prisma.storeProject.findUnique({ where: { id: projectId } });
  if (!project || project.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const section = await prisma.storeStageSection.findUnique({
    where: { stageId_sectionId: { stageId: parsed.data.stageId, sectionId } },
  });
  if (!section) return NextResponse.json({ error: "Section not found" }, { status: 404 });
  const versions = section.versions as unknown as SectionVersion<unknown>[];
  if (!versions.find((v) => v.id === parsed.data.versionId)) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  const updated = await prisma.storeStageSection.update({
    where: { stageId_sectionId: { stageId: parsed.data.stageId, sectionId } },
    data: {
      approvedVersionId: parsed.data.versionId,
      activeVersionId: parsed.data.versionId,
    },
  });
  return NextResponse.json({ section: updated });
}
