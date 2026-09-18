// app/api/me/llm-providers/route.ts
//
// GET  — list the current user's LlmProvider rows (no plaintext keys).
// POST — create a new LlmProvider with encrypted api_key.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptKey, hintFromKey } from "@/lib/crypto/llm-provider-keys";

export const runtime = "nodejs";

const VALID_KINDS = ["openai_compat", "anthropic", "gemini"] as const;
type ValidKind = (typeof VALID_KINDS)[number];

function isValidKind(v: unknown): v is ValidKind {
  return typeof v === "string" && (VALID_KINDS as readonly string[]).includes(v);
}

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

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await prisma.llmProvider.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ providers: rows.map(shape) });
}

interface PostBody {
  name?: unknown;
  kind?: unknown;
  base_url?: unknown;
  api_key?: unknown;
  default_model?: unknown;
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as PostBody;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const kind = body.kind;
  const baseUrl = typeof body.base_url === "string" && body.base_url.length > 0 ? body.base_url : null;
  const apiKey = typeof body.api_key === "string" ? body.api_key : "";
  const defaultModel = typeof body.default_model === "string" && body.default_model.length > 0 ? body.default_model : null;

  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });
  if (!isValidKind(kind)) return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  if (!apiKey) return NextResponse.json({ error: "api_key_required" }, { status: 400 });
  if (kind === "openai_compat" && !baseUrl) {
    return NextResponse.json({ error: "base_url_required_for_openai_compat" }, { status: 400 });
  }

  const dup = await prisma.llmProvider.findUnique({
    where: { userId_name: { userId: session.user.id, name } },
  });
  if (dup) return NextResponse.json({ error: "name_taken" }, { status: 409 });

  const env = encryptKey(apiKey);
  const created = await prisma.llmProvider.create({
    data: {
      userId: session.user.id,
      name,
      kind,
      baseUrl,
      apiKeyCipher: env.ciphertext,
      apiKeyIv: env.iv,
      apiKeyAuthTag: env.authTag,
      apiKeyHint: hintFromKey(apiKey),
      defaultModel,
    },
  });

  return NextResponse.json(shape(created), { status: 201 });
}
