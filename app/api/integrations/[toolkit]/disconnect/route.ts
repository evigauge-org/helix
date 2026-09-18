import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { composio, TOOLKIT_AUTH_CONFIG_MAP } from "@/lib/composio";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractList(connections: any): any[] {
  if (Array.isArray(connections)) return connections;
  if (connections?.items && Array.isArray(connections.items)) return connections.items;
  if (connections?.data && Array.isArray(connections.data)) return connections.data;
  if (connections?.connectedAccounts && Array.isArray(connections.connectedAccounts)) return connections.connectedAccounts;
  return [];
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ toolkit: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { toolkit } = await params;
  const authConfigId = TOOLKIT_AUTH_CONFIG_MAP[toolkit];
  if (!authConfigId) {
    return NextResponse.json({ error: "Unknown or not-configured toolkit" }, { status: 400 });
  }

  try {
    const existing = await composio.connectedAccounts.list({
      userIds: [session.user.id],
      authConfigIds: [authConfigId],
      statuses: ["ACTIVE"],
    });
    const list = extractList(existing);
    for (const conn of list) {
      const id = conn.id ?? conn.connectedAccountId;
      if (!id) continue;
      try {
        await composio.connectedAccounts.delete(id);
      } catch (e) {
        console.error(`Disconnect failed for ${toolkit}:${id}`, e);
      }
    }
    return NextResponse.json({ disconnected: true });
  } catch (error) {
    console.error("Disconnect error:", error);
    return NextResponse.json({ disconnected: true });
  }
}
