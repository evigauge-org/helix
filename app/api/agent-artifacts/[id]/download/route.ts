import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

function escapeFilename(name: string): string {
  return name.replace(/[\r\n"\\]/g, "_");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;

  const artifact = await prisma.agentArtifact.findUnique({
    where: { id },
    include: { run: { select: { agent: { select: { userId: true } } } } },
  });
  if (!artifact) return new Response("Not found", { status: 404 });
  if (artifact.run.agent.userId !== session.user.id)
    return new Response("Forbidden", { status: 403 });

  const content = artifact.content ?? "";
  const dataMatch = /^data:([^;]+);base64,([\s\S]+)$/.exec(content);
  if (dataMatch) {
    const mime = dataMatch[1];
    const bytes = Buffer.from(dataMatch[2], "base64");
    return new Response(bytes, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="${escapeFilename(artifact.name)}"`,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(content, {
    headers: {
      "Content-Type": artifact.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${escapeFilename(artifact.name)}"`,
      "Cache-Control": "no-store",
    },
  });
}
