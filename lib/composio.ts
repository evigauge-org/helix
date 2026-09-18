import { Composio } from "@composio/core";

// Constructed lazily on first use rather than at import time.
//
// The Composio client throws when COMPOSIO_API_KEY is absent. Building it at
// module scope meant that throw happened during `next build` page-data
// collection — so the whole application failed to build for anyone without a
// Composio account, even though only the integrations routes use it. Seventeen
// modules import this, so one missing optional key broke everything.
//
// The Proxy keeps the `composio` export and every call site identical while
// deferring construction until a property is actually read. A request that
// genuinely needs Composio now fails with a clear message at request time,
// which is what the documented behaviour promises.
let client: Composio | null = null;

function getClient(): Composio {
  if (client) return client;
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    throw new Error(
      "COMPOSIO_API_KEY is not configured. Set it to use the Composio-backed " +
        "integrations (Canva, Gmail, Shopify, Sheets).",
    );
  }
  client = new Composio({
    apiKey,
    toolkitVersions: {
      canva: "20260407_00",
    },
  });
  return client;
}

export const composio = new Proxy({} as Composio, {
  get(_target, prop) {
    const c = getClient() as unknown as Record<string | symbol, unknown>;
    const value = c[prop];
    return typeof value === "function" ? value.bind(c) : value;
  },
});

export const CANVA_AUTH_CONFIG_ID = process.env.CANVA_AUTH_CONFIG_ID!;
export const GMAIL_AUTH_CONFIG_ID = process.env.COMPOSIO_GMAIL_AUTH_CONFIG_ID!;
export const SHOPIFY_AUTH_CONFIG_ID = process.env.COMPOSIO_SHOPIFY_AUTH_CONFIG_ID ?? "";
export const SHEETS_AUTH_CONFIG_ID = process.env.COMPOSIO_SHEETS_AUTH_CONFIG_ID!;

export const TOOLKIT_AUTH_CONFIG_MAP: Record<string, string> = {
  canva: CANVA_AUTH_CONFIG_ID,
  gmail: GMAIL_AUTH_CONFIG_ID,
  shopify: SHOPIFY_AUTH_CONFIG_ID,
  sheets: SHEETS_AUTH_CONFIG_ID,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function executeCanvaTool(action: string, userId: string, args: Record<string, any>) {
  return composio.tools.execute(action, {
    userId,
    arguments: args,
  });
}
