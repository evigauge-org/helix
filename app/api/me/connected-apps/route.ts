// app/api/me/connected-apps/route.ts
//
// GET — list the current user's OAuth-granted access tokens (one row per
// (client, user) consent). Joined with the OAuthClient for display info.
// Used by the /settings/connected-apps page.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const tokens = await prisma.oAuthAccessToken.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    include: { client: { select: { name: true, icon: true, uri: true, clientId: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    tokens.map((t) => ({
      id: t.id,
      clientId: t.client.clientId,
      clientName: t.client.name ?? t.client.clientId,
      clientIcon: t.client.icon,
      clientUri: t.client.uri,
      scopes: t.scopes,
      createdAt: t.createdAt.toISOString(),
      expiresAt: t.expiresAt.toISOString(),
    })),
  );
}
