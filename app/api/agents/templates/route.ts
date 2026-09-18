import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { seedAgentTemplates } from "@/lib/agents/templates";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const select = {
    slug: true,
    name: true,
    category: true,
    goal: true,
    description: true,
    iconName: true,
    docPolicy: true,
    reviewerRoleHint: true,
    version: true,
  } as const;

  let templates = await prisma.agentTemplate.findMany({
    where: { enabled: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select,
  });

  // First-call self-seed: if the catalog is empty, upsert from the in-code
  // registry so the gallery is never dead-empty for a fresh deploy. Idempotent;
  // existing rows are upserted so a stale row at v1 also gets bumped to v2.
  if (templates.length === 0) {
    try {
      await seedAgentTemplates();
      templates = await prisma.agentTemplate.findMany({
        where: { enabled: true },
        orderBy: [{ category: "asc" }, { name: "asc" }],
        select,
      });
    } catch (err) {
      console.warn("[templates GET] auto-seed failed:", err);
    }
  }

  return NextResponse.json({ templates });
}
