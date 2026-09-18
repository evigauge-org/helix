import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";

// POST — course-correct current stage
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const { feedback } = await req.json();

  const project = await prisma.storeProject.findFirst({
    where: { id: projectId, userId: session.user.id },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.storeStage.updateMany({
    where: { projectId, stage: project.currentStage },
    data: { status: "editing", userFeedback: feedback },
  });

  await inngest.send({
    name: "store/stage.edited",
    data: { projectId, stage: project.currentStage, feedback },
  });

  return NextResponse.json({ editing: true });
}
