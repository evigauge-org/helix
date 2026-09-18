import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { seedAgentTemplates } from "@/lib/agents/templates";

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await seedAgentTemplates();
  return NextResponse.json(result);
}
