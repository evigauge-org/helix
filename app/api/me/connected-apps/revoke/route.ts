// app/api/me/connected-apps/revoke/route.ts
//
// POST — revoke a single OAuth access token AND its sibling refresh tokens
// for the same (client, user) pair AND the consent row, so the next time the
// app starts an auth flow the user is re-prompted instead of getting silent
// approval. Ownership is enforced via the userId scope on every delete.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await req.json().catch(() => ({}))) as { tokenId?: unknown };
  const tokenId = typeof body.tokenId === "string" ? body.tokenId : null;
  if (!tokenId) return NextResponse.json({ error: "tokenId_required" }, { status: 400 });

  const token = await prisma.oAuthAccessToken.findUnique({
    where: { id: tokenId },
    select: { id: true, userId: true, clientId: true },
  });
  if (!token || token.userId !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Delete the access token, all matching refresh tokens, and the consent row
  // for this (client, user) pair so the next auth flow re-prompts.
  await prisma.$transaction([
    prisma.oAuthAccessToken.deleteMany({ where: { userId, clientId: token.clientId } }),
    prisma.oAuthRefreshToken.deleteMany({ where: { userId, clientId: token.clientId } }),
    prisma.oAuthConsent.deleteMany({ where: { userId, clientId: token.clientId } }),
  ]);

  return NextResponse.json({ ok: true });
}
