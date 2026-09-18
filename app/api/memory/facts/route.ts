import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const facts = await prisma.userMemoryFact.findMany({
    where: { userId: session.user.id },
    orderBy: [{ category: "asc" }, { confidence: "desc" }],
  });
  return Response.json({ facts });
}

export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const all = searchParams.get("all") === "true";
  if (all) {
    await prisma.userMemoryFact.deleteMany({ where: { userId: session.user.id } });
    return Response.json({ deleted: "all" });
  }
  if (!id) return new Response("Missing id", { status: 400 });
  await prisma.userMemoryFact.deleteMany({ where: { id, userId: session.user.id } });
  return Response.json({ deleted: id });
}
