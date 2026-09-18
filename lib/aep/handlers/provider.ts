// lib/aep/handlers/provider.ts
//
// AEP method: provider.list
// Returns the authenticated user's LLM providers WITHOUT plaintext keys.

import { prisma } from "@/lib/prisma";
import type { AepContext } from "../context";

interface ProviderListParams {
  // no params — always lists the calling user's providers
}

interface ProviderListItem {
  id: string;
  name: string;
  kind: "openai_compat" | "anthropic" | "gemini";
  base_url: string | null;
  api_key_hint: string;
  default_model: string | null;
  last_tested_at: string | null;
  last_test_status: string | null;
  created_at: string;
  updated_at: string;
}

interface ProviderListResult {
  providers: ProviderListItem[];
}

export async function providerList(
  _params: ProviderListParams,
  ctx: AepContext,
): Promise<ProviderListResult> {
  const rows = await prisma.llmProvider.findMany({
    where: { userId: ctx.userId },
    orderBy: { createdAt: "desc" },
  });
  return {
    providers: rows.map((p) => ({
      id: p.id,
      name: p.name,
      kind: p.kind as ProviderListItem["kind"],
      base_url: p.baseUrl,
      api_key_hint: p.apiKeyHint,
      default_model: p.defaultModel,
      last_tested_at: p.lastTestedAt?.toISOString() ?? null,
      last_test_status: p.lastTestStatus,
      created_at: p.createdAt.toISOString(),
      updated_at: p.updatedAt.toISOString(),
    })),
  };
}
