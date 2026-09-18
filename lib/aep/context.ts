// lib/aep/context.ts
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AepError } from "./errors";
import { AEP_WILDCARD } from "./authz/scopes";

export interface AepContext {
  userId: string;
  sessionId: string | null;       // AepSession.aepId, null if not yet initialized
  negotiatedCapabilities: Record<string, boolean>;
  protocolVersion: string | null; // e.g. "aep-2026-04-24"
  scopes: string[];               // resolved AEP scopes for this caller
  authMethod: "api-key" | "session";
}

export const PROTOCOL_VERSION = "aep-2026-04-24";
export const HEADER_PROTOCOL_VERSION = "agent-protocol-version";
export const HEADER_SESSION_ID = "x-aep-session-id";

// Read the AEP scopes for an api-key-backed session. Better-auth's synthetic
// session has session.id === apiKey.id (api-key plugin source line ~2182), so
// we look up the apikey row by id and JSON.parse its `permissions` column.
async function resolveScopesForApiKey(apiKeyId: string): Promise<string[]> {
  const row = await prisma.apiKey.findUnique({
    where: { id: apiKeyId },
    select: { permissions: true },
  });
  if (!row?.permissions) return [];
  try {
    const parsed = JSON.parse(row.permissions) as { aep?: unknown } | null;
    if (parsed && Array.isArray(parsed.aep)) {
      return parsed.aep.filter((s): s is string => typeof s === "string");
    }
  } catch {
    // Malformed permissions JSON — treat as no scopes. Logged once per request
    // by the dispatcher when the resulting authz_denied surfaces.
  }
  return [];
}

// Look up an OAuth access token issued by @better-auth/oauth-provider. Tokens
// are opaque random strings stored in oauth_access_token; the plugin doesn't
// inject them into `auth.api.getSession({ headers })`, so we resolve them
// explicitly here. Returns null when the token isn't found or has expired.
async function resolveOAuthAccessToken(
  bearerToken: string,
): Promise<{ userId: string; scopes: string[] } | null> {
  const row = await prisma.oAuthAccessToken.findUnique({
    where: { token: bearerToken },
    select: { userId: true, scopes: true, expiresAt: true },
  });
  if (!row || !row.userId) return null;
  if (row.expiresAt <= new Date()) return null;
  return { userId: row.userId, scopes: row.scopes };
}

export async function resolveAepContext(req: NextRequest): Promise<AepContext> {
  const headers = req.headers;
  const proto = headers.get(HEADER_PROTOCOL_VERSION);
  if (proto && proto !== PROTOCOL_VERSION) {
    throw new AepError("version_mismatch", `Unsupported protocol version: ${proto}`);
  }

  // Auth resolution order:
  //   1. Bearer hlx_…  → api-key plugin claims via getSession (existing path)
  //   2. Bearer <other> → try OAuth access token lookup before falling through
  //                       to better-auth's session/cookie resolution
  //   3. Cookie         → browser session (UI-trusted, gets aep:* wildcard)
  const authz = headers.get("authorization");
  const bearer = authz?.startsWith("Bearer ") ? authz.slice(7).trim() : null;
  const isHlxKey = bearer?.startsWith("hlx_") ?? false;

  let userId: string;
  let scopes: string[];
  let authMethod: "api-key" | "session";

  const oauthHit = bearer && !isHlxKey ? await resolveOAuthAccessToken(bearer) : null;
  if (oauthHit) {
    // OAuth-issued tokens carry their granted scopes directly. Treat as
    // "api-key" semantics for downstream — narrow scoped, non-cookie.
    userId = oauthHit.userId;
    scopes = oauthHit.scopes;
    authMethod = "api-key";
  } else {
    // Resolve the user. Pass the real Headers object (not a plain dict) — the
    // api-key plugin's customAPIKeyGetter reads via `ctx.headers.get(...)`
    // and bearer/cookie paths also work through real Headers.
    const session = await auth.api.getSession({ headers });
    const uid = session?.user?.id ?? null;
    if (!uid) throw new AepError("authn_failed", "Missing or invalid credentials");
    userId = uid;

    // Determine scopes. The api-key plugin sets session.token to the raw key
    // value; hlx_-prefixed tokens are AEP api-keys and carry per-key scopes.
    // UI/cookie sessions (browser-authenticated user) get the wildcard since
    // the user already authenticated through the browser and the UI is trusted.
    const token = session?.session?.token;
    const isApiKey = typeof token === "string" && token.startsWith("hlx_");
    authMethod = isApiKey ? "api-key" : "session";
    scopes = isApiKey
      ? await resolveScopesForApiKey(session!.session.id)
      : [AEP_WILDCARD];
  }

  const sessionAepId = headers.get(HEADER_SESSION_ID);
  if (!sessionAepId) {
    return {
      userId,
      sessionId: null,
      negotiatedCapabilities: {},
      protocolVersion: proto ?? null,
      scopes,
      authMethod,
    };
  }

  const row = await prisma.aepSession.findUnique({ where: { aepId: sessionAepId } });
  if (!row || row.userId !== userId) {
    throw new AepError("session_expired", "Unknown or expired AEP session");
  }
  await prisma.aepSession.update({ where: { id: row.id }, data: { lastSeenAt: new Date() } });
  return {
    userId,
    sessionId: sessionAepId,
    negotiatedCapabilities: (row.negotiatedCapabilities as Record<string, boolean>) ?? {},
    protocolVersion: row.protocolVersion,
    scopes,
    authMethod,
  };
}
