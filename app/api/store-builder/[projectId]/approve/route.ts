// app/api/store-builder/[projectId]/approve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { z } from "zod";

const body = z.object({ stage: z.number().int().min(1).max(5), autoApproveRemaining: z.boolean().optional() });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { projectId } = await params;
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.format() }, { status: 400 });

  const project = await prisma.storeProject.findUnique({ where: { id: projectId } });
  if (!project || project.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stageRow = await prisma.storeStage.findFirst({
    where: { projectId, stage: parsed.data.stage },
    include: { sections: true },
  });
  if (!stageRow) return NextResponse.json({ error: "Stage not found" }, { status: 404 });

  const unapproved = stageRow.sections.filter((s) => !s.approvedVersionId);
  if (unapproved.length > 0) {
    if (!parsed.data.autoApproveRemaining) {
      return NextResponse.json(
        { error: "Sections not approved", unapprovedSectionIds: unapproved.map((s) => s.sectionId) },
        { status: 409 },
      );
    }
    for (const s of unapproved) {
      await prisma.storeStageSection.update({
        where: { id: s.id },
        data: { approvedVersionId: s.activeVersionId },
      });
    }
  }

  await prisma.storeStage.update({
    where: { id: stageRow.id },
    data: { status: "approved" },
  });
  await inngest.send({ name: "store/stage.approved", data: { projectId, stage: parsed.data.stage } });
  return NextResponse.json({ ok: true });
}
