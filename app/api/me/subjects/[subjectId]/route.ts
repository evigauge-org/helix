// app/api/me/subjects/[subjectId]/route.ts
//
// GET    — DSAR snapshot via subject.read (truncated artifact content).
// PATCH  — update metadata / legalHold.
// DELETE — delete the Subject row itself (NOT the same as subject.erase —
//          this just removes the Subject metadata row; tagged records
//          stay tagged. For real GDPR erasure use the /erase endpoint.).

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subjectRead } from "@/lib/aep/handlers/subject";
import { AepError } from "@/lib/aep/errors";

export const runtime = "nodejs";

type Params = { params: Promise<{ subjectId: string }> };

async function authorize(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return null;
  return session.user.id;
}

export async function GET(req: NextRequest, { params }: Params) {
  const userId = await authorize(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { subjectId } = await params;
  try {
    const snapshot = await subjectRead({ subject_id: subjectId }, makeCtx(userId));
    return NextResponse.json(snapshot);
  } catch (e) {
    if (e instanceof AepError) {
      return NextResponse.json({ error: e.symbol, message: e.message }, { status: e.symbol === "subject_not_found" ? 404 : 400 });
    }
    throw e;
  }
}

interface PatchBody {
  metadata?: unknown;
  legalHold?: unknown;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const userId = await authorize(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { subjectId } = await params;
  const subject = await prisma.subject.findFirst({ where: { aepId: subjectId, userId } });
  if (!subject) return NextResponse.json({ error: "subject_not_found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as PatchBody;
  const data: Record<string, unknown> = {};
  if (body.metadata !== undefined) data.metadata = (body.metadata as object | null) ?? null;
  if (typeof body.legalHold === "boolean") data.legalHold = body.legalHold;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "no_updates" }, { status: 400 });
  }
  const updated = await prisma.subject.update({ where: { id: subject.id }, data: data as any });
  return NextResponse.json({
    id: updated.id,
    subject_id: updated.aepId,
    metadata: updated.metadata ?? {},
    legal_hold: updated.legalHold,
    updated_at: updated.updatedAt.toISOString(),
  });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const userId = await authorize(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { subjectId } = await params;
  const subject = await prisma.subject.findFirst({ where: { aepId: subjectId, userId } });
  if (!subject) return NextResponse.json({ error: "subject_not_found" }, { status: 404 });
  await prisma.subject.delete({ where: { id: subject.id } });
  return NextResponse.json({ ok: true });
}

// Build a minimal AepContext for the handler. The handler only reads userId
// and trusts upstream gates (RPC dispatcher) for scope/capability — for
// these UI-bound calls the user's browser session implicitly grants aep:*.
function makeCtx(userId: string) {
  return {
    userId,
    sessionId: null,
    negotiatedCapabilities: { "compliance.gdpr": true },
    protocolVersion: null,
    scopes: ["aep:*"],
    authMethod: "session" as const,
  };
}
