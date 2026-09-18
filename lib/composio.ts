import { Composio } from "@composio/core";

export const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY!,
  toolkitVersions: {
    canva: "20260407_00",
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
