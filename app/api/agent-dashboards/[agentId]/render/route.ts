import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { wrapBody } from "@/lib/agents/dashboards/wrapper";

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'none'",
].join("; ");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const { agentId } = await params;
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { userId: true },
  });
  if (!agent || agent.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  const dash = await prisma.agentDashboard.findUnique({
    where: { agentId },
  });
  if (!dash) return new Response("No dashboard yet", { status: 404 });

  const html = wrapBody(dash.bodyHtml, dash.title);
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": CSP,
      "Cache-Control": "no-store",
    },
  });
}
