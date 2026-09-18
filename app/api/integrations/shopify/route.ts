import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const connected = !!(process.env.SHOPIFY_ACCESS_TOKEN && process.env.SHOPIFY_STORE_URL);

  return NextResponse.json({
    connected,
    storeUrl: connected ? `https://${process.env.SHOPIFY_STORE_URL}` : null,
  });
}
