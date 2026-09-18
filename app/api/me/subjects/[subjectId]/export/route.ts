// app/api/me/subjects/[subjectId]/export/route.ts
//
// GET — full DSAR bundle as a JSON download. Calls subject.export under the
// hood. Sets Content-Disposition so the browser saves the response to a
// file rather than rendering it.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { subjectExport } from "@/lib/aep/handlers/subject";
import { AepError } from "@/lib/aep/errors";

export const runtime = "nodejs";

type Params = { params: Promise<{ subjectId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { subjectId } = await params;
  try {
    const bundle = await subjectExport(
      { subject_id: subjectId },
      {
        userId,
        sessionId: null,
        negotiatedCapabilities: { "compliance.gdpr": true },
        protocolVersion: null,
        scopes: ["aep:*"],
        authMethod: "session" as const,
      },
    );
    const filename = `subject-${subjectId}-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(bundle, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
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
