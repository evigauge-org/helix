import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { slug } = await params;
  const tpl = await prisma.agentTemplate.findUnique({ where: { slug } });
  if (!tpl || !tpl.enabled) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ template: tpl });
}
