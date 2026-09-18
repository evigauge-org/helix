import { composio, CANVA_AUTH_CONFIG_ID } from "@/lib/composio";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractList(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (v?.items && Array.isArray(v.items)) return v.items;
  if (v?.data && Array.isArray(v.data)) return v.data;
  if (v?.connectedAccounts && Array.isArray(v.connectedAccounts)) return v.connectedAccounts;
  return [];
}

export async function resolveConnectedAccountId(userId: string): Promise<string | undefined> {
  const conns = await composio.connectedAccounts.list({
    userIds: [userId],
    authConfigIds: [CANVA_AUTH_CONFIG_ID],
    statuses: ["ACTIVE"],
  });
  const list = extractList(conns);
  if (list.length === 0) return undefined;
  return (list[0].id ?? list[0].connectedAccountId) as string | undefined;
}

export type ConnectionResult =
  | { ok: true; connectedAccountId: string }
  | { ok: false; error: string; connect_url?: string };

export async function requireCanvaConnection(userId: string): Promise<ConnectionResult> {
  const connectedAccountId = await resolveConnectedAccountId(userId);
  if (connectedAccountId) return { ok: true, connectedAccountId };

  try {
    const connRequest = await composio.connectedAccounts.initiate(
      userId,
      CANVA_AUTH_CONFIG_ID,
      {
        callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/integrations`,
        allowMultiple: true,
      },
    );
    return {
      ok: false,
      error:
        "Canva is not connected. Show the connect_url to the user as a clickable link, ask them to click it and authorize Canva, and retry once they confirm.",
      connect_url: connRequest.redirectUrl ?? undefined,
    };
  } catch (error) {
    console.error("Composio connect error (agent tool):", error);
    return {
      ok: false,
      error: "Canva not connected and could not initiate OAuth. Ask the user to connect it at /integrations.",
    };
  }
}
