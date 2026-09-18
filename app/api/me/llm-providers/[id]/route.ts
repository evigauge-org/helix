// app/api/me/llm-providers/[id]/route.ts
//
// GET    — read a single provider (no plaintext key)
// PATCH  — update name / base_url / default_model / rotate api_key
// DELETE — delete; refuses with 409 if any agent references this provider

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptKey, hintFromKey } from "@/lib/crypto/llm-provider-keys";

export const runtime = "nodejs";

function shape(p: {
  id: string;
  name: string;
  kind: string;
  baseUrl: string | null;
  apiKeyHint: string;
  defaultModel: string | null;
  lastTestedAt: Date | null;
  lastTestStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: p.id,
    name: p.name,
    kind: p.kind,
    base_url: p.baseUrl,
    api_key_hint: p.apiKeyHint,
    default_model: p.defaultModel,
    last_tested_at: p.lastTestedAt?.toISOString() ?? null,
    last_test_status: p.lastTestStatus,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
  };
}

async function requireOwned(req: NextRequest, id: string) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return { error: "unauthorized" as const, status: 401, userId: null, row: null };
  const row = await prisma.llmProvider.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!row) return { error: "not_found" as const, status: 404, userId: session.user.id, row: null };
  return { error: null, status: 200, userId: session.user.id, row };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await requireOwned(req, id);
  if (r.error) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(shape(r.row));
}

interface PatchBody {
  name?: unknown;
  base_url?: unknown;
  default_model?: unknown;
  api_key?: unknown;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await requireOwned(req, id);
  if (r.error) return NextResponse.json({ error: r.error }, { status: r.status });

  const body = (await req.json().catch(() => ({}))) as PatchBody;
  const data: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim().length > 0) {
    const newName = body.name.trim();
    if (newName !== r.row.name) {
      const dup = await prisma.llmProvider.findUnique({
        where: { userId_name: { userId: r.userId, name: newName } },
      });
      if (dup) return NextResponse.json({ error: "name_taken" }, { status: 409 });
      data.name = newName;
    }
  }
  if (body.base_url !== undefined) {
    data.baseUrl = typeof body.base_url === "string" && body.base_url.length > 0 ? body.base_url : null;
  }
  if (body.default_model !== undefined) {
    data.defaultModel = typeof body.default_model === "string" && body.default_model.length > 0 ? body.default_model : null;
  }
  if (typeof body.api_key === "string" && body.api_key.length > 0) {
    const env = encryptKey(body.api_key);
    data.apiKeyCipher = env.ciphertext;
    data.apiKeyIv = env.iv;
    data.apiKeyAuthTag = env.authTag;
    data.apiKeyHint = hintFromKey(body.api_key);
    data.lastTestedAt = null;
    data.lastTestStatus = null;
  }

  const updated = await prisma.llmProvider.update({ where: { id }, data });
  return NextResponse.json(shape(updated));
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await requireOwned(req, id);
  if (r.error) return NextResponse.json({ error: r.error }, { status: r.status });

  const inUse = await prisma.agent.count({ where: { runnerProviderId: id } });
  if (inUse > 0) {
    return NextResponse.json(
      { error: "provider_in_use", agent_count: inUse },
      { status: 409 },
    );
  }

  await prisma.llmProvider.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
