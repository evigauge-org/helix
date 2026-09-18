// app/api/me/llm-providers/[id]/test/route.ts
//
// POST — fire a 1-token completion against the provider to verify the key.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptKey } from "@/lib/crypto/llm-provider-keys";
import { configForUnsavedProvider, dispatchTest } from "@/lib/agents/llm/dispatch";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const row = await prisma.llmProvider.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let apiKey: string;
  try {
    apiKey = decryptKey({ iv: row.apiKeyIv, authTag: row.apiKeyAuthTag, ciphertext: row.apiKeyCipher });
  } catch {
    return NextResponse.json({ ok: false, kind: "decrypt_failed", message: "Cannot decrypt — re-enter the key." });
  }

  const model = row.defaultModel ?? defaultPingModel(row.kind);
  const config = configForUnsavedProvider({
    kind: row.kind as "openai_compat" | "anthropic" | "gemini",
    baseUrl: row.baseUrl,
    apiKey,
    model,
  });

  const result = await dispatchTest(config);

  await prisma.llmProvider.update({
    where: { id },
    data: {
      lastTestedAt: new Date(),
      lastTestStatus: result.ok ? "ok" : result.kind,
    },
  });

  return NextResponse.json(result);
}

function defaultPingModel(kind: string): string {
  // Lightweight model per provider — small/fast for ping.
  switch (kind) {
    case "anthropic":
      return "claude-haiku-4.5";
    case "gemini":
      return "gemini-2.0-flash";
    case "openai_compat":
    default:
      return "gpt-4o-mini";
  }
}
