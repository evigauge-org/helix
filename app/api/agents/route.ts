import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";

const CreateAgentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  goal: z.string().min(1).optional(),
  toolSlugs: z.array(z.enum([
    "web_search", "fetch_url", "llm_reason",
    "save_artifact", "send_email", "post_to_chat",
    "search_knowledge",
    "run_code",
    "screener_company",
    "sec_edgar_company_search", "sec_edgar_filings", "sec_edgar_xbrl_facts",
    "yahoo_finance_quote", "yahoo_finance_financials", "macrotrends_history",
    "crunchbase_company", "precedent_transactions_search", "precedent_transaction_extract",
    "valuation_football_field", "acquirer_capacity_score",
    "assemble_ib_pitch_book",
    "data_gov_in_catalog_search", "data_gov_in_dataset_fetch",
    "india_rbi_policy_rates", "india_rbi_fx_reference_rates",
    "india_mospi_cpi", "india_mospi_wpi",
    "india_sebi_mutual_fund_aum", "india_gdp_series", "india_iip_index",
    "india_insurance_factsheet_fetch",
    "india_insurance_factsheet_extract",
    "create_enterprise_report", "write_rows", "get_spreadsheet", "find_spreadsheet",
    "get_market_price", "get_option_chain", "update_dashboard",
    "download_file", "download_nse_report",
    "create_canva_presentation", "create_pptx", "import_canva_from_file",
    "create_canva_design", "get_canva_design_metadata", "list_canva_designs",
    "llm_debate", "create_docx",
    "source_linkedin_profiles", "scrape_firm_directory", "cross_reference_candidate",
  ])).optional(),
  systemPromptExtra: z.string().optional(),
  createdBy: z.enum(["chat", "form", "dialog", "template"]),
  createdInChatId: z.string().optional(),
  runnerModel: z.string().optional(),
  maxStepsPerCycle: z.number().int().positive().optional(),
  maxCycleDurationSecs: z.number().int().positive().optional(),
  maxTokensPerCycle: z.number().int().positive().optional(),
  maxLifetimeDays: z.number().int().positive().optional(),
  maxTotalTokens: z.number().int().positive().optional(),
  maxTicks: z.number().int().positive().optional(),
  draftToken: z.string().optional(),
  templateSlug: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const parsed = CreateAgentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;

  const existingCount = await prisma.agent.count({
    where: { userId, deletedAt: null },
  });
  if (existingCount >= 100) {
    return Response.json({ error: "Agent limit reached (100)" }, { status: 400 });
  }

  const constitution = await prisma.systemConstitution.findUnique({ where: { id: 1 } });
  if (!constitution) {
    return Response.json({ error: "SystemConstitution not initialized" }, { status: 500 });
  }

  // Template prefill: when templateSlug is present, pull defaults from the
  // AgentTemplate row. User-provided fields still win when set, so the dialog
  // can rename / retool an instance before submit. constitutionPolicy is
  // derived from the template's selfImprovementPolicy.modifyOwnPrompt
  // (autoPromote:true → "auto", false → "approval_required") so the existing
  // prompt-modification pipeline does the right thing for compliance agents.
  let template:
    | {
        slug: string;
        name: string;
        goal: string;
        defaultToolSlugs: string[];
        systemPromptBase: string;
        version: number;
        selfImprovementPolicyJson: unknown;
      }
    | null = null;
  if (data.templateSlug) {
    template = await prisma.agentTemplate.findUnique({
      where: { slug: data.templateSlug },
      select: {
        slug: true,
        name: true,
        goal: true,
        defaultToolSlugs: true,
        systemPromptBase: true,
        version: true,
        selfImprovementPolicyJson: true,
      },
    });
    if (!template) {
      return Response.json({ error: "template_not_found" }, { status: 400 });
    }
  }

  const resolvedName = (data.name ?? template?.name ?? "").trim();
  const resolvedGoal = (data.goal ?? template?.goal ?? "").trim();
  const resolvedToolSlugs = data.toolSlugs ?? template?.defaultToolSlugs ?? [];
  const resolvedSystemPromptExtra = data.systemPromptExtra ?? template?.systemPromptBase ?? null;
  if (!resolvedName || !resolvedGoal || resolvedToolSlugs.length === 0) {
    return Response.json({ error: "name + goal + toolSlugs are required (directly or via template)" }, { status: 400 });
  }

  const policy = (template?.selfImprovementPolicyJson ?? null) as
    | { modifyOwnPrompt?: { autoPromote?: boolean } }
    | null;
  const constitutionPolicy: "auto" | "approval_required" =
    template && policy?.modifyOwnPrompt?.autoPromote === false ? "approval_required" : "auto";

  const maxStepsPerCycle = data.maxStepsPerCycle ?? 50;
  const maxCycleDurationSecs = data.maxCycleDurationSecs ?? 1800;
  const maxTokensPerCycle = data.maxTokensPerCycle ?? 500000;
  const maxLifetimeDays = data.maxLifetimeDays ?? 30;
  const maxTotalTokens = data.maxTotalTokens ?? 5000000;
  const maxTicks = data.maxTicks ?? 500;

  const agent = await prisma.$transaction(async (tx) => {
    const created = await tx.agent.create({
      data: {
        userId,
        name: resolvedName,
        goal: resolvedGoal,
        systemPromptExtra: resolvedSystemPromptExtra,
        toolSlugs: resolvedToolSlugs,
        runnerModel: data.runnerModel ?? "anthropic/claude-haiku-4.5",
        maxStepsPerCycle,
        maxCycleDurationSecs,
        maxTokensPerCycle,
        maxLifetimeDays,
        maxTotalTokens,
        maxTicks,
        createdBy: data.createdBy,
        createdInChatId: data.createdInChatId,
        parentAgentId: null,
        rootAgentId: "__placeholder__",
        constitutionVersion: constitution.version,
        templateSlug: template?.slug ?? null,
        templateVersion: template?.version ?? null,
        constitutionPolicy,
      },
    });

    const updated = await tx.agent.update({
      where: { id: created.id },
      data: { rootAgentId: created.id },
    });

    await tx.agentHardCeiling.create({
      data: {
        agentId: created.id,
        maxStepsPerCycleCeiling: maxStepsPerCycle,
        maxCycleDurationCeiling: maxCycleDurationSecs,
        maxTokensPerCycleCeiling: maxTokensPerCycle,
        maxLifetimeDaysCeiling: maxLifetimeDays,
        maxTotalTokensCeiling: maxTotalTokens,
        maxTicksCeiling: maxTicks,
      },
    });

    if (data.draftToken) {
      await tx.agentKnowledgeSource.updateMany({
        where: { draftToken: data.draftToken, userId, agentId: null },
        data: { agentId: created.id, draftToken: null },
      });
      await tx.agentKnowledgeChunk.updateMany({
        where: { source: { agentId: created.id, userId } },
        data: { agentId: created.id },
      });
    }

    return updated;
  });

  await inngest.send({ name: "agent/run.start", data: { agentId: agent.id, userId } });

  return Response.json({ agentId: agent.id });
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const userId = session.user.id;

  const agents = await prisma.agent.findMany({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      runs: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { id: true, status: true, startedAt: true, nextWakeAt: true },
      },
    },
  });

  return Response.json({ agents });
}
