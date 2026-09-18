// app/api/me/api-keys/route.ts
//
// Server-side proxy for creating an api-key WITH AEP scopes. Better-auth's
// public POST /api/auth/api-key/create endpoint refuses to set the `permissions`
// field from a client request (returns 400 SERVER_ONLY_PROPERTY). We need
// permissions to carry per-key AEP scopes, so we authenticate the user first
// using the request headers, then call `auth.api.createApiKey` server-side
// without forwarding headers — the api-key plugin's `isClientRequest` check
// only triggers when ctx.request or ctx.headers is set.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AEP_SCOPES, AEP_WILDCARD, type AepScope } from "@/lib/aep/authz/scopes";

export const runtime = "nodejs";

type CreateBody = {
  name?: unknown;
  scopes?: unknown;
};

function sanitizeScopes(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const out: string[] = [];
  let sawWildcard = false;
  for (const entry of input) {
    if (typeof entry !== "string") return null;
    if (entry === AEP_WILDCARD) {
      sawWildcard = true;
      continue;
    }
    if (!(AEP_SCOPES as readonly string[]).includes(entry)) return null;
    out.push(entry as AepScope);
  }
  // Wildcard collapses everything else.
  if (sawWildcard) return [AEP_WILDCARD];
  return out;
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });

  const scopes = sanitizeScopes(body.scopes);
  if (scopes === null) {
    return NextResponse.json({ error: "invalid_scopes" }, { status: 400 });
  }
  if (scopes.length === 0) {
    return NextResponse.json({ error: "no_scopes_selected" }, { status: 400 });
  }

  // Server-side call: omit `headers` so the plugin treats this as a server
  // request and allows the `permissions` field.
  const created = await auth.api.createApiKey({
    body: {
      name,
      userId,
      permissions: { aep: scopes },
    },
  });

  return NextResponse.json(created);
}
