// app/aep/v1/rpc/route.ts
import { registerAll } from "@/lib/aep/register";
registerAll();

import { NextRequest, NextResponse } from "next/server";
import { AepError } from "@/lib/aep/errors";
import { resolveAepContext, PROTOCOL_VERSION } from "@/lib/aep/context";
import { dispatcher } from "@/lib/aep/rpc/dispatch";
import { errorEnvelope, isValidRequest, successEnvelope } from "@/lib/aep/rpc/envelope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(errorEnvelope(null, -32700, "Parse error"), { status: 400 });
  }
  if (!isValidRequest(body)) {
    return NextResponse.json(errorEnvelope(null, -32600, "Invalid Request"), { status: 400 });
  }

  const { id, method, params } = body;

  try {
    const ctx = await resolveAepContext(req);
    // initialize is special — session may not exist yet, dispatcher still works.
    const result = await dispatcher.dispatch(method, params ?? {}, ctx);
    return NextResponse.json(successEnvelope(id, result), {
      headers: { "Agent-Protocol-Version": PROTOCOL_VERSION },
    });
  } catch (e) {
    if (e instanceof AepError) {
      const env = errorEnvelope(id, e.code, e.message, e.data);
      return NextResponse.json(env, { status: 200, headers: { "Agent-Protocol-Version": PROTOCOL_VERSION } });
    }
    const msg = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json(errorEnvelope(id, -32603, msg), { status: 500 });
  }
}
