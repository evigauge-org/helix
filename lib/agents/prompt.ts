import { prisma } from "@/lib/prisma";
import type { ToolDef } from "./types";
import { SHEETS_CONVENTIONS } from "@/lib/agents/prompts/sheets-conventions";
import { MARKETS_CONVENTIONS } from "@/lib/agents/prompts/markets-conventions";
import { DASHBOARD_CONVENTIONS } from "@/lib/agents/prompts/dashboard-conventions";
import { DOWNLOADS_CONVENTIONS } from "@/lib/agents/prompts/downloads-conventions";
import { CANVA_CONVENTIONS } from "@/lib/agents/prompts/canva-conventions";
import { DEBATE_AND_DOCX_CONVENTIONS } from "@/lib/agents/prompts/debate-and-docx-conventions";
import { RECRUITMENT_CONVENTIONS } from "@/lib/agents/prompts/recruitment-conventions";

export async function buildSystemPrompt(params: {
  agentId: string;
  tools: ToolDef[];
}): Promise<string> {
  const SHEETS_TOOL_SLUGS = new Set(["create_enterprise_report", "write_rows", "get_spreadsheet", "find_spreadsheet"]);
  const hasSheetsTool = params.tools.some((t) => SHEETS_TOOL_SLUGS.has(t.slug));
  const MARKETS_TOOL_SLUGS = new Set(["get_market_price", "get_option_chain"]);
  const hasMarketsTool = params.tools.some((t) => MARKETS_TOOL_SLUGS.has(t.slug));
  const marketsBlock = hasMarketsTool ? "\n\n" + MARKETS_CONVENTIONS : "";
  const hasDashboardTool = params.tools.some((t) => t.slug === "update_dashboard");
  const dashboardBlock = hasDashboardTool ? "\n\n" + DASHBOARD_CONVENTIONS : "";
  const DOWNLOAD_TOOL_SLUGS = new Set(["download_file", "download_nse_report"]);
  const hasDownloadTool = params.tools.some((t) => DOWNLOAD_TOOL_SLUGS.has(t.slug));
  const downloadsBlock = hasDownloadTool ? "\n\n" + DOWNLOADS_CONVENTIONS : "";
  const CANVA_TOOL_SLUGS = new Set([
    "create_canva_presentation",
    "create_pptx",
    "import_canva_from_file",
    "create_canva_design",
    "get_canva_design_metadata",
    "list_canva_designs",
  ]);
  const hasCanvaTool = params.tools.some((t) => CANVA_TOOL_SLUGS.has(t.slug));
  const canvaBlock = hasCanvaTool ? "\n\n" + CANVA_CONVENTIONS : "";
  const DEBATE_DOCX_TOOL_SLUGS = new Set(["llm_debate", "create_docx"]);
  const hasDebateOrDocx = params.tools.some((t) => DEBATE_DOCX_TOOL_SLUGS.has(t.slug));
  const debateDocxBlock = hasDebateOrDocx ? "\n\n" + DEBATE_AND_DOCX_CONVENTIONS : "";
  const RECRUITMENT_TOOL_SLUGS = new Set([
    "source_linkedin_profiles",
    "scrape_firm_directory",
    "cross_reference_candidate",
  ]);
  const hasRecruitmentTool = params.tools.some((t) => RECRUITMENT_TOOL_SLUGS.has(t.slug));
  const recruitmentBlock = hasRecruitmentTool ? "\n\n" + RECRUITMENT_CONVENTIONS : "";
  const [agent, constitution] = await Promise.all([
    prisma.agent.findUnique({
      where: { id: params.agentId },
      include: { skills: { orderBy: { updatedAt: "desc" }, take: 20 } },
    }),
    prisma.systemConstitution.findUnique({ where: { id: 1 } }),
  ]);
  if (!agent || !constitution) throw new Error("agent or constitution missing");

  const toolCatalog = params.tools
    .map((t) => `- ${t.slug}: ${t.description}`)
    .join("\n");

  const skillsBlock = agent.skills.length
    ? `\nYour saved skills (invoke via run_skill(name)):\n${agent.skills.map((s) => `- ${s.name}: ${s.description}`).join("\n")}`
    : "";

  const personaBlock = agent.systemPromptExtra
    ? `\nAdditional persona/instructions from your creator:\n${agent.systemPromptExtra}`
    : "";

  const now = new Date();
  const datetimeBlock = `Current date & time (use this — not your training cutoff — for any "today", "yesterday", "latest", or relative-date reasoning):
- Date: ${now.toISOString().slice(0, 10)}
- ISO timestamp: ${now.toISOString()}
- Day of week (UTC): ${now.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })}`;

  return `You are an autonomous agent named "${agent.name}" running inside Helix.

CONSTITUTION (immutable, overrides all else):
${constitution.text}

${datetimeBlock}

Your goal:
${agent.goal}
${personaBlock}
${skillsBlock}

Tools available to you this cycle:
${toolCatalog}

Behaviour rules:
- Each cycle, think step-by-step, call tools as needed, and end the cycle by calling exactly one control tool: sleep, complete, or continue_now.
- If you need time for a long-running process (like "check again in 6 hours"), call sleep(duration_seconds, reason).
- If your goal is achieved, call complete(final_message, artifact_ids?) — the final_message is posted to the user's chat automatically.
- If you need to immediately run another cycle without sleeping, call continue_now().
- Return structured errors gracefully: when a tool returns { ok: false, error }, adapt and try a different approach.
- Never claim to have done something you have not actually verified via a tool call.${hasSheetsTool ? "\n\n" + SHEETS_CONVENTIONS : ""}${marketsBlock}${dashboardBlock}${downloadsBlock}${canvaBlock}${debateDocxBlock}${recruitmentBlock}`;
}
