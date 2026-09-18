// app/aep/v1/artifacts/[id]/bytes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAepContext, PROTOCOL_VERSION } from "@/lib/aep/context";
import { hasScope } from "@/lib/aep/authz/scopes";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await resolveAepContext(req);
  if (!hasScope(ctx.scopes, "run.read")) {
    return NextResponse.json({ error: "authz_denied", message: "Artifact bytes require scope run.read" }, { status: 200 });
  }
  const a = await prisma.agentArtifact.findFirst({
    where: { aepId: id, run: { userId: ctx.userId } },
  });
  if (!a) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const body: Buffer = a.bytes ? Buffer.from(a.bytes) : Buffer.from(a.content ?? "", "utf8");
  return new NextResponse(body as unknown as BodyInit, {
    headers: {
      "Content-Type": a.mimeType,
      "Content-Length": String(body.length),
      "Agent-Protocol-Version": PROTOCOL_VERSION,
    },
  });
}
