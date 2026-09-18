// app/api/store-builder/[projectId]/sections/[sectionId]/edit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { z } from "zod";
import type { SectionVersion } from "@/lib/store-builder/types";

const body = z.object({
  stageId: z.string(),
  content: z.unknown(),
  regenerationPrompt: z.string().optional(),
});

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

  const existing = await prisma.storeStageSection.findUnique({
    where: { stageId_sectionId: { stageId: parsed.data.stageId, sectionId } },
  });
  const versionsPrev = (existing?.versions as unknown as SectionVersion<unknown>[]) ?? [];
  const newVersion: SectionVersion<unknown> = {
    id: randomUUID(),
    content: parsed.data.content,
    author: "user",
    createdAt: new Date().toISOString(),
    regenerationPrompt: parsed.data.regenerationPrompt,
  };

  const section = await prisma.storeStageSection.upsert({
    where: { stageId_sectionId: { stageId: parsed.data.stageId, sectionId } },
    create: {
      stageId: parsed.data.stageId,
      sectionId,
      versions: [newVersion] as never,
      activeVersionId: newVersion.id,
    },
    update: {
      versions: [...versionsPrev, newVersion] as never,
      activeVersionId: newVersion.id,
    },
  });

  return NextResponse.json({ section });
}
