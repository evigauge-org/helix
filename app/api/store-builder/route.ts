import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import type { StoreBrief } from "@/lib/store-builder/types";

// GET — list user's store projects
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await prisma.storeProject.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { stages: { orderBy: { stage: "asc" } } },
  });

  return NextResponse.json({ projects });
}

// POST — create a new store project + trigger Inngest pipeline
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { brief } = (await req.json()) as { brief: StoreBrief };
  if (!brief?.niche?.length || !brief?.products?.length) {
    return NextResponse.json({ error: "Brief is incomplete" }, { status: 400 });
  }

  const project = await prisma.storeProject.create({
    data: {
      userId: session.user.id,
      brief: JSON.parse(JSON.stringify(brief)),
      status: "researching",
      currentStage: 1,
      stages: {
        create: [
          { stage: 1, name: "research", status: "running" },
          { stage: 2, name: "catalog", status: "pending" },
          { stage: 3, name: "branding", status: "pending" },
          { stage: 4, name: "social", status: "pending" },
          { stage: 5, name: "shopify", status: "pending" },
        ],
      },
    },
    include: { stages: true },
  });

  await inngest.send({
    name: "store/build.started",
    data: { projectId: project.id, brief },
  });

  return NextResponse.json({ project });
}
