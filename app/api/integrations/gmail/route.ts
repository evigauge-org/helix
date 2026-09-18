import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { composio, GMAIL_AUTH_CONFIG_ID } from "@/lib/composio";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractList(connections: any): any[] {
  if (Array.isArray(connections)) return connections;
  if (connections?.items && Array.isArray(connections.items)) return connections.items;
  if (connections?.data && Array.isArray(connections.data)) return connections.data;
  if (connections?.connectedAccounts && Array.isArray(connections.connectedAccounts)) return connections.connectedAccounts;
  return [];
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const connections = await composio.connectedAccounts.list({
      userIds: [session.user.id],
      authConfigIds: [GMAIL_AUTH_CONFIG_ID],
      statuses: ["ACTIVE"],
    });
    const list = extractList(connections);
    const connected = list.length > 0;
    return NextResponse.json({
      connected,
      accountId: connected ? (list[0].id ?? list[0].connectedAccountId ?? null) : null,
    });
  } catch (error) {
    console.error("Gmail status error:", error);
    return NextResponse.json({ connected: false, accountId: null });
  }
}

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const existing = await composio.connectedAccounts.list({
      userIds: [session.user.id],
      authConfigIds: [GMAIL_AUTH_CONFIG_ID],
      statuses: ["ACTIVE"],
    });
    const list = extractList(existing);
    if (list.length > 0) {
      return NextResponse.json({
        connected: true,
        accountId: list[0].id ?? list[0].connectedAccountId ?? null,
        message: "Already connected",
      });
    }
    const connRequest = await composio.connectedAccounts.initiate(
      session.user.id,
      GMAIL_AUTH_CONFIG_ID,
      {
        callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/integrations`,
        allowMultiple: true,
      },
    );
    return NextResponse.json({ redirectUrl: connRequest.redirectUrl });
  } catch (error) {
    console.error("Gmail connect error:", error);
    return NextResponse.json({ error: "Failed to initiate connection" }, { status: 500 });
  }
}
