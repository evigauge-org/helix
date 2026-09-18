// app/api/settings/data-gov-in/key/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptDataGovInKey, maskKey } from "@/lib/crypto/data-gov-in-keys";

const postSchema = z.object({
  apiKey: z.string().min(8).max(200),
});

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const row = await prisma.userDataGovInKey.findUnique({
    where: { userId: session.user.id },
    select: { keyMask: true, status: true, rotatedAt: true, lastUsedAt: true, createdAt: true },
  });
  if (!row) return NextResponse.json({ hasKey: false });
  return NextResponse.json({
    hasKey: true,
    keyMask: row.keyMask,
    status: row.status,
    rotatedAt: row.rotatedAt?.toISOString() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  });
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const apiKey = parsed.data.apiKey.trim();
  const envelope = encryptDataGovInKey(apiKey);
  const mask = maskKey(apiKey);
  const now = new Date();
  const existing = await prisma.userDataGovInKey.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  await prisma.userDataGovInKey.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      iv: envelope.iv,
      authTag: envelope.authTag,
      ciphertext: envelope.ciphertext,
      keyMask: mask,
      status: "active",
    },
    update: {
      iv: envelope.iv,
      authTag: envelope.authTag,
      ciphertext: envelope.ciphertext,
      keyMask: mask,
      status: "active",
      rotatedAt: existing ? now : null,
    },
  });
  return NextResponse.json({ ok: true, keyMask: mask, status: "active" });
}

export async function DELETE() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await prisma.userDataGovInKey.deleteMany({ where: { userId: session.user.id } });
  return NextResponse.json({ ok: true });
}
