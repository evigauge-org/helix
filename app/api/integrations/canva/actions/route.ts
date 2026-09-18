import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { composio, executeCanvaTool } from "@/lib/composio";

// POST — execute a Canva tool action
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, params } = await req.json();

  try {
    const result = await executeCanvaTool(action, session.user.id, params ?? {});
    return NextResponse.json({ result });
  } catch (error) {
    console.error("Canva action error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Action failed" },
      { status: 500 },
    );
  }
}

// GET — list available Canva tools
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const tools = await composio.tools.get(session.user.id, {
      toolkits: ["canva"],
      limit: 50,
    });

     
    const toolList = Array.isArray(tools)
      ? tools.map((t: any) => ({
          name: t?.function?.name ?? t?.name ?? "unknown",
          description: t?.function?.description ?? t?.description ?? "",
        }))
      : [];

    return NextResponse.json({ tools: toolList });
  } catch (error) {
    console.error("Canva tools error:", error);
    return NextResponse.json({ tools: [] });
  }
}
