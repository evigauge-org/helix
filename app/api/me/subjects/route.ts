// app/api/me/subjects/route.ts
//
// GET  — list the current user's Subject rows.
// POST — create a new Subject. Body: { aepId?, metadata?, legalHold? }.
//        aepId is auto-generated as `sub_<ulid>` if omitted.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { newAepId } from "@/lib/aep/ids";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const subjects = await prisma.subject.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    subjects.map((s) => ({
      id: s.id,
      subject_id: s.aepId,
      metadata: s.metadata ?? {},
      legal_hold: s.legalHold,
      created_at: s.createdAt.toISOString(),
      updated_at: s.updatedAt.toISOString(),
    })),
  );
}

interface PostBody {
  aepId?: unknown;
  metadata?: unknown;
  legalHold?: unknown;
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as PostBody;
  const aepIdInput = typeof body.aepId === "string" && body.aepId.startsWith("sub_") ? body.aepId : null;
  const aepId = aepIdInput ?? newAepId("sub");
  const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : null;
  const legalHold = body.legalHold === true;

  const created = await prisma.subject.create({
    data: {
      aepId,
      userId: session.user.id,
      metadata: (metadata ?? undefined) as any,
      legalHold,
    },
  });

  return NextResponse.json({
    id: created.id,
    subject_id: created.aepId,
    metadata: created.metadata ?? {},
    legal_hold: created.legalHold,
    created_at: created.createdAt.toISOString(),
    updated_at: created.updatedAt.toISOString(),
  });
}
