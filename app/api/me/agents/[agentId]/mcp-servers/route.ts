// app/api/me/agents/[agentId]/mcp-servers/route.ts
//
// GET  — list a user-owned agent's external MCP servers (auth REDACTED).
// POST — attach a new external MCP server to the agent.
//
// Both verify ownership via session-user → agent.userId, and POST runs
// SSRF-blocking URL validation before persisting.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateExternalMcpUrl } from "@/lib/aep/mcp/url-validation";

export const runtime = "nodejs";

type Params = { params: Promise<{ agentId: string }> };

async function authorize(req: NextRequest, agentId: string) {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;
  if (!userId) return { ok: false as const, status: 401, body: { error: "unauthorized" } };
  // Accept either the public AEP id (`agt_…`) or the internal cuid — UI
  // routes carry the cuid, AEP-wire callers carry the aepId.
  const agent = await prisma.agent.findFirst({
    where: { OR: [{ aepId: agentId }, { id: agentId }], userId },
    select: { id: true },
  });
  if (!agent) return { ok: false as const, status: 404, body: { error: "agent_not_found" } };
  return { ok: true as const, userId, agentRowId: agent.id };
}

function redact(row: {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  authJson: unknown;
  lastConnectedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
}) {
  const auth = (row.authJson ?? null) as { bearer?: string; headers?: Record<string, string> } | null;
  const hasBearer = typeof auth?.bearer === "string" && auth.bearer.length > 0;
  const hasHeaders = !!auth?.headers && Object.keys(auth.headers).length > 0;
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    enabled: row.enabled,
    hasBearer,
    customHeaderCount: hasHeaders ? Object.keys(auth!.headers!).length : 0,
    lastConnectedAt: row.lastConnectedAt?.toISOString() ?? null,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  const { agentId } = await params;
  const auth = await authorize(req, agentId);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });
  const rows = await prisma.agentExternalMcpServer.findMany({
    where: { agentId: auth.agentRowId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(rows.map(redact));
}

interface PostBody {
  name?: unknown;
  url?: unknown;
  auth?: unknown;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { agentId } = await params;
  const auth = await authorize(req, agentId);
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status });

  const body = (await req.json().catch(() => ({}))) as PostBody;
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });
  if (!url) return NextResponse.json({ error: "url_required" }, { status: 400 });

  const urlCheck = validateExternalMcpUrl(url);
  if (!urlCheck.ok) return NextResponse.json({ error: urlCheck.error }, { status: 400 });

  // Coerce + sanitize the auth shape: only bearer + headers are accepted.
  let authJson: { bearer?: string; headers?: Record<string, string> } | null = null;
  if (body.auth && typeof body.auth === "object") {
    const a = body.auth as { bearer?: unknown; headers?: unknown };
    const out: { bearer?: string; headers?: Record<string, string> } = {};
    if (typeof a.bearer === "string" && a.bearer.length > 0) out.bearer = a.bearer;
    if (a.headers && typeof a.headers === "object") {
      const h: Record<string, string> = {};
      for (const [k, v] of Object.entries(a.headers as Record<string, unknown>)) {
        if (typeof v === "string") h[k] = v;
      }
      if (Object.keys(h).length > 0) out.headers = h;
    }
    if (out.bearer || out.headers) authJson = out;
  }

  const created = await prisma.agentExternalMcpServer
    .create({
      data: {
        agentId: auth.agentRowId,
        name,
        url,
        authJson: authJson as any,
      },
    })
    .catch((e: unknown) => {
      const code = (e as { code?: string } | null)?.code;
      if (code === "P2002") {
        return null; // unique-name conflict
      }
      throw e;
    });
  if (created === null) {
    return NextResponse.json({ error: "name_conflict" }, { status: 409 });
  }
  return NextResponse.json(redact(created));
}
