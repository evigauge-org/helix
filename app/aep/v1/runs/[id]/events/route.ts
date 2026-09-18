// app/aep/v1/runs/[id]/events/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveAepContext, PROTOCOL_VERSION } from "@/lib/aep/context";
import { hasScope } from "@/lib/aep/authz/scopes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 500;
const MAX_OPEN_MS = 30 * 60 * 1000;    // 30m cap

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: runAepId } = await params;
  const ctx = await resolveAepContext(req);

  if (!hasScope(ctx.scopes, "stream.subscribe") || !hasScope(ctx.scopes, "run.read")) {
    return new Response(
      JSON.stringify({ error: "authz_denied", message: "SSE requires scopes stream.subscribe and run.read" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const run = await prisma.agentRun.findFirst({ where: { aepId: runAepId, userId: ctx.userId } });
  if (!run) return new Response("not_found", { status: 404 });

  const since = req.nextUrl.searchParams.get("since");
  let lastSeq = 0;
  if (since) {
    const e = await prisma.aepEvent.findUnique({ where: { aepId: since } });
    if (e) lastSeq = e.sequenceNum;
  }

  const enc = new TextEncoder();
  const openedAt = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const close = () => { try { controller.close(); } catch {} };

      const pushBatch = async (): Promise<boolean> => {
        const batch = await prisma.aepEvent.findMany({
          where: { runId: run.id, sequenceNum: { gt: lastSeq } },
          orderBy: { sequenceNum: "asc" },
          take: 200,
        });
        for (const ev of batch) {
          const data = {
            event_id: ev.aepId,
            run_id: run.aepId,
            type: ev.type,
            emitted_at: ev.emittedAt.toISOString(),
            payload: ev.payload,
          };
          controller.enqueue(enc.encode(`event: ${ev.type}\n`));
          controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
          lastSeq = ev.sequenceNum;
        }
        return batch.length > 0;
      };

      // initial drain + heartbeat loop
      await pushBatch();
      const iv = setInterval(async () => {
        try {
          await pushBatch();
          if (Date.now() - openedAt > MAX_OPEN_MS) {
            clearInterval(iv);
            close();
            return;
          }
          // heartbeat comment
          controller.enqueue(enc.encode(`: ping\n\n`));
        } catch (e) {
          clearInterval(iv);
          close();
        }
      }, POLL_INTERVAL_MS);

      req.signal.addEventListener("abort", () => { clearInterval(iv); close(); });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Agent-Protocol-Version": PROTOCOL_VERSION,
    },
  });
}
