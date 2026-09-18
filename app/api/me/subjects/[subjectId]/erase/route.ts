// app/api/me/subjects/[subjectId]/erase/route.ts
//
// POST — run subject.erase with the requested mode. Returns the manifest.
// Body: { mode: "redact" | "hard_delete" }.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { subjectErase } from "@/lib/aep/handlers/subject";
import { AepError } from "@/lib/aep/errors";

export const runtime = "nodejs";

type Params = { params: Promise<{ subjectId: string }> };

interface PostBody {
  mode?: unknown;
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { subjectId } = await params;

  const body = (await req.json().catch(() => ({}))) as PostBody;
  const mode = body.mode === "hard_delete" ? "hard_delete" : "redact";

  try {
    const manifest = await subjectErase(
      { subject_id: subjectId, mode },
      {
        userId,
        sessionId: null,
        negotiatedCapabilities: { "compliance.gdpr": true },
        protocolVersion: null,
        scopes: ["aep:*"],
        authMethod: "session" as const,
      },
    );
    return NextResponse.json(manifest);
  } catch (e) {
    if (e instanceof AepError) {
      return NextResponse.json(
        { error: e.symbol, message: e.message },
        { status: e.symbol === "subject_not_found" ? 404 : 400 },
      );
    }
    throw e;
  }
}
