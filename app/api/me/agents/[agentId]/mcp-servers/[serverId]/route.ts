// app/api/me/agents/[agentId]/mcp-servers/[serverId]/route.ts
//
// PATCH  — update an existing MCP server attachment (name / url / enabled / auth).
// DELETE — remove the attachment.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateExternalMcpUrl } from "@/lib/aep/mcp/url-validation";

export const runtime = "nodejs";

type Params = { params: Promise<{ agentId: string; serverId: string }> };

async function authorizeAndLoad(req: NextRequest, agentId: string, serverId: string) {
  const session = await auth.api.getSession({ headers: req.headers });
  const userId = session?.user?.id;
  if (!userId) return { ok: false as const, status: 401, body: { error: "unauthorized" } };
  const agent = await prisma.agent.findFirst({
    where: { OR: [{ aepId: agentId }, { id: agentId }], userId },
    select: { id: true },
  });
  if (!agent) return { ok: false as const, status: 404, body: { error: "agent_not_found" } };
  const server = await prisma.agentExternalMcpServer.findFirst({
    where: { id: serverId, agentId: agent.id },
  });
  if (!server) return { ok: false as const, status: 404, body: { error: "server_not_found" } };
  return { ok: true as const, agentRowId: agent.id, server };
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
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    enabled: row.enabled,
    hasBearer: typeof auth?.bearer === "string" && auth.bearer.length > 0,
    customHeaderCount: auth?.headers ? Object.keys(auth.headers).length : 0,
    lastConnectedAt: row.lastConnectedAt?.toISOString() ?? null,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
  };
}

interface PatchBody {
  name?: unknown;
  url?: unknown;
  enabled?: unknown;
  auth?: unknown;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { agentId, serverId } = await params;
  const ctx = await authorizeAndLoad(req, agentId, serverId);
  if (!ctx.ok) return NextResponse.json(ctx.body, { status: ctx.status });

  const body = (await req.json().catch(() => ({}))) as PatchBody;
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.url === "string" && body.url.trim()) {
    const check = validateExternalMcpUrl(body.url.trim());
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
    data.url = body.url.trim();
  }
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  if (body.auth !== undefined) {
    if (body.auth === null) {
      data.authJson = null;
    } else if (typeof body.auth === "object") {
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
      data.authJson = (out.bearer || out.headers) ? out : null;
    }
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "no_updates" }, { status: 400 });
  }
  const updated = await prisma.agentExternalMcpServer
    .update({ where: { id: serverId }, data: data as any })
    .catch((e: unknown) => {
      const code = (e as { code?: string } | null)?.code;
      if (code === "P2002") return null;
      throw e;
    });
  if (updated === null) {
    return NextResponse.json({ error: "name_conflict" }, { status: 409 });
  }
  return NextResponse.json(redact(updated));
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { agentId, serverId } = await params;
  const ctx = await authorizeAndLoad(req, agentId, serverId);
  if (!ctx.ok) return NextResponse.json(ctx.body, { status: ctx.status });
  await prisma.agentExternalMcpServer.delete({ where: { id: serverId } });
  return NextResponse.json({ ok: true });
}
