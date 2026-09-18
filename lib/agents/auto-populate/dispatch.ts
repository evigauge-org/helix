import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { dispatchChat } from "@/lib/agents/llm/dispatch";
import { decryptKey } from "@/lib/crypto/llm-provider-keys";
import type { LlmConfig } from "@/lib/agents/llm/types";
import type { AgentKnowledgeSource } from "../../../generated/prisma/client";
import { buildKnowledgeDigest, buildSystemPrompt } from "./prompts";

const ALLOWED_TOOL_SLUGS = new Set([
  "web_search", "fetch_url", "llm_reason", "save_artifact", "send_email", "post_to_chat",
  "create_enterprise_report", "write_rows", "get_spreadsheet", "find_spreadsheet",
  "get_market_price", "get_option_chain", "update_dashboard",
  "download_file", "download_nse_report",
  "create_canva_presentation", "create_pptx", "import_canva_from_file",
  "create_canva_design", "get_canva_design_metadata", "list_canva_designs",
  "llm_debate", "create_docx",
  "source_linkedin_profiles", "scrape_firm_directory", "cross_reference_candidate",
  "search_knowledge",
]);

const ResponseSchema = z.object({
  name: z.string().min(1).max(200),
  goal: z.string().min(1).max(500),
  systemPromptExtra: z.string().max(2000),
  toolSlugs: z.array(z.string()),
  reasoning: z.string().max(300),
});

export interface AutoPopulateInput {
  userId: string;
  sources: AgentKnowledgeSource[];
  userPromptHint?: string;
}

export interface AutoPopulateOutput {
  name: string;
  goal: string;
  systemPromptExtra: string;
  toolSlugs: string[];
  reasoning: string;
  providerUsed: "byo" | "managed";
  tokensUsed: number;
}

async function resolveUserLlmConfig(userId: string): Promise<{ config: LlmConfig; providerUsed: "byo" | "managed" }> {
  const provider = await prisma.llmProvider.findFirst({
    where: { userId, defaultModel: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  if (provider) {
    const apiKey = decryptKey({
      iv: provider.apiKeyIv,
      authTag: provider.apiKeyAuthTag,
      ciphertext: provider.apiKeyCipher,
    });
    const baseUrl =
      provider.baseUrl ??
      (provider.kind === "anthropic"
        ? "https://api.anthropic.com"
        : provider.kind === "gemini"
          ? "https://generativelanguage.googleapis.com"
          : "");
    if (!baseUrl) {
      throw new Error(`Provider ${provider.id} has kind=openai_compat but no baseUrl`);
    }
    return {
      config: {
        kind: provider.kind as LlmConfig["kind"],
        apiKey,
        baseUrl,
        model: provider.defaultModel || "",
      },
      providerUsed: "byo",
    };
  }
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Managed fallback requires OPENROUTER_API_KEY");
  return {
    config: {
      kind: "managed",
      apiKey,
      baseUrl: "https://openrouter.ai/api/v1",
      model: "anthropic/claude-haiku-4.5",
    },
    providerUsed: "managed",
  };
}

export async function autoPopulate(input: AutoPopulateInput): Promise<AutoPopulateOutput> {
  const digest = await buildKnowledgeDigest(input.sources);
  const systemPrompt = buildSystemPrompt({
    digest,
    userPromptHint: input.userPromptHint,
    currentDateIso: new Date().toISOString(),
  });

  const { config, providerUsed } = await resolveUserLlmConfig(input.userId);

  const response = await dispatchChat(config, {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Generate the agent spec JSON now." },
    ],
    tools: [],
    max_tokens: 600,
    temperature: 0.3,
  });

  const content = response.content?.trim() ?? "";
  // Strip leading ```json or ``` and trailing ``` if present.
  const stripped = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new Error(`Auto-populate LLM returned invalid JSON: ${content.slice(0, 200)}`);
  }
  const validated = ResponseSchema.parse(parsed);

  // Filter to allowed slugs only and ensure search_knowledge is present.
  const filteredSlugs = validated.toolSlugs.filter((s) => ALLOWED_TOOL_SLUGS.has(s));
  if (!filteredSlugs.includes("search_knowledge")) filteredSlugs.push("search_knowledge");

  return {
    name: validated.name,
    goal: validated.goal,
    systemPromptExtra: validated.systemPromptExtra,
    toolSlugs: filteredSlugs,
    reasoning: validated.reasoning,
    providerUsed,
    tokensUsed: response.usage.total_tokens,
  };
}
