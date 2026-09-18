import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;

  const agent = await prisma.agent.findUnique({
    where: { id },
    include: {
      hardCeiling: true,
      skills: true,
      runs: {
        orderBy: { startedAt: "desc" },
        take: 20,
      },
      children: {
        select: { id: true, name: true, updatedAt: true },
      },
    },
  });

  if (!agent) return new Response("Not found", { status: 404 });
  if (agent.userId !== session.user.id) return new Response("Forbidden", { status: 403 });

  return Response.json({ agent });
}
