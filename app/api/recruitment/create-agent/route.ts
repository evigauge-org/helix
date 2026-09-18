// app/api/recruitment/create-agent/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { z } from "zod";

const bodySchema = z.object({
  chatSessionId: z.string().optional(),
  agentName: z.string().min(1).max(100),
  agentGoal: z.string().min(1).max(4000),
  filters: z.record(z.string(), z.unknown()),
  validation: z.record(z.string(), z.unknown()),
  sourceUrls: z.array(z.string().url()).max(30).default([]),
  maxCandidates: z.number().int().positive().max(100).default(20),
});

// Preselected tools for recruitment agents.
// NOTE: control tools (sleep, complete, continue_now) and self-mod / replicate / inbox
// tools are ALWAYS_PRESENT via lib/agents/tool-registry.ts and do NOT need to be listed.
const RECRUITMENT_TOOL_SLUGS = [
  "source_linkedin_profiles",
  "scrape_firm_directory",
  "cross_reference_candidate",
  "create_docx",
  "create_enterprise_report",
  "send_email",
  "post_to_chat",
  "web_search",
  "fetch_url",
  "llm_reason",
];

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
  }
  const { chatSessionId, agentName, agentGoal, filters, validation, sourceUrls, maxCandidates } = parsed.data;

  const existingCount = await prisma.agent.count({ where: { userId, deletedAt: null } });
  if (existingCount >= 100) {
    return NextResponse.json({ error: "Agent limit reached (100)" }, { status: 400 });
  }

  const constitution = await prisma.systemConstitution.findUnique({ where: { id: 1 } });
  if (!constitution) {
    return NextResponse.json({ error: "SystemConstitution not initialized" }, { status: 500 });
  }

  const filtersWithMax = { ...filters, maxItems: Math.min(maxCandidates, 50) };
  const systemPromptExtra = [
    "## Recruitment brief",
    "",
    "### Apify filters (pass to source_linkedin_profiles):",
    "```json",
    JSON.stringify(filtersWithMax, null, 2),
    "```",
    "",
    "### Validation (pass to cross_reference_candidate):",
    "```json",
    JSON.stringify(validation, null, 2),
    "```",
    "",
    "### User-provided source URLs (pass to cross_reference_candidate sourceUrls):",
    sourceUrls.length > 0 ? sourceUrls.map((u) => `- ${u}`).join("\n") : "(none)",
    "",
    `### maxCandidates: ${maxCandidates}`,
    "",
    `### User email (if known): ${session.user.email ?? "(unavailable — use post_to_chat only)"}`,
  ].join("\n");

  const maxStepsPerCycle = 50;
  const maxCycleDurationSecs = 1800;
  const maxTokensPerCycle = 500000;
  const maxLifetimeDays = 30;
  const maxTotalTokens = 5000000;
  const maxTicks = 500;

  const agent = await prisma.$transaction(async (tx) => {
    const created = await tx.agent.create({
      data: {
        userId,
        name: agentName,
        goal: agentGoal,
        systemPromptExtra,
        toolSlugs: RECRUITMENT_TOOL_SLUGS,
        runnerModel: "anthropic/claude-haiku-4.5",
        maxStepsPerCycle,
        maxCycleDurationSecs,
        maxTokensPerCycle,
        maxLifetimeDays,
        maxTotalTokens,
        maxTicks,
        createdBy: "chat",
        createdInChatId: chatSessionId,
        parentAgentId: null,
        rootAgentId: "__placeholder__",
        constitutionVersion: constitution.version,
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

    return updated;
  });

  await inngest.send({ name: "agent/run.start", data: { agentId: agent.id, userId } });

  return NextResponse.json({ agent: { id: agent.id, name: agent.name, goal: agent.goal } });
}
