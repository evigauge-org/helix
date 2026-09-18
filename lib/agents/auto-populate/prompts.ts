import type { AgentKnowledgeSource } from "../../../generated/prisma/client";
import { getPageIndexClient } from "../knowledge/pageindex-client";
import { prisma } from "@/lib/prisma";

const TOOL_CATALOG = `
- web_search: search the web
- search_knowledge: search the user's uploaded knowledge corpus (always include this when sources exist)
- fetch_url: fetch the contents of a URL
- llm_reason: think step-by-step about a problem
- save_artifact: save artifacts (text, JSON, images) for the user
- send_email: send an email
- post_to_chat: post a message to the user's chat
- create_enterprise_report: render a multi-page enterprise report
- write_rows / get_spreadsheet / find_spreadsheet: Google Sheets operations
- get_market_price: real-time market data
- get_option_chain: options chain data
- update_dashboard: update the agent's dashboard
- download_file / download_nse_report: download files / NSE reports
- create_canva_presentation / create_pptx / create_docx: produce documents
- import_canva_from_file / create_canva_design / get_canva_design_metadata / list_canva_designs: Canva ops
- llm_debate: multi-LLM debate
- source_linkedin_profiles / scrape_firm_directory / cross_reference_candidate: recruiting ops
`.trim();

interface DigestSection {
  filename: string;
  lane: "pageindex" | "pgvector";
  body: string;
}

async function buildPageindexDigest(source: AgentKnowledgeSource): Promise<string> {
  if (!source.pageindexDocId) return "(no doc id yet)";
  try {
    const tree = await getPageIndexClient().api.getTree(source.pageindexDocId, {
      nodeSummary: true,
    });
    if (tree.status !== "completed" || !tree.result) return "(still processing)";
    const lines: string[] = [];
    function walk(nodes: Array<{ title: string; text?: string; nodes?: unknown }>, depth: number) {
      for (const n of nodes) {
        if (lines.length >= 20) return;
        const indent = "  ".repeat(depth);
        const summary = n.text ? n.text.slice(0, 200) : "";
        lines.push(`${indent}- ${n.title}${summary ? ` — ${summary}` : ""}`);
        if (Array.isArray(n.nodes)) {
          walk(n.nodes as Array<{ title: string; text?: string; nodes?: unknown }>, depth + 1);
        }
      }
    }
    walk(tree.result as Array<{ title: string; text?: string; nodes?: unknown }>, 0);
    return lines.join("\n");
  } catch {
    return "(tree unavailable)";
  }
}

async function buildPgvectorDigest(source: AgentKnowledgeSource): Promise<string> {
  try {
    const chunks = await prisma.agentKnowledgeChunk.findMany({
      where: { sourceId: source.id },
      orderBy: { chunkIndex: "asc" },
      take: 3,
      select: { content: true },
    });
    if (chunks.length === 0) return "(no chunks)";
    return chunks.map((c, i) => `[chunk ${i}] ${c.content.slice(0, 600)}`).join("\n\n");
  } catch {
    return "(chunks unavailable)";
  }
}

export async function buildKnowledgeDigest(sources: AgentKnowledgeSource[]): Promise<string> {
  const sections: DigestSection[] = await Promise.all(
    sources.map(async (s) => ({
      filename: s.filename,
      lane: s.lane as "pageindex" | "pgvector",
      body:
        s.lane === "pageindex"
          ? await buildPageindexDigest(s)
          : await buildPgvectorDigest(s),
    })),
  );
  return sections
    .map(
      (s, i) =>
        `${i + 1}. ${s.filename} (${s.lane === "pageindex" ? "PDF" : "text"})\n${s.body}`,
    )
    .join("\n\n");
}

export function buildSystemPrompt(args: {
  digest: string;
  userPromptHint?: string;
  currentDateIso: string;
}): string {
  return [
    `You are designing an autonomous worker agent for the Helix platform based on documents the user uploaded. Today is ${args.currentDateIso}.`,
    "",
    "The agent will operate independently, picking tools each tick to advance toward its goal.",
    "",
    "Available tool slugs (return a SUBSET — only the ones genuinely useful for this corpus):",
    TOOL_CATALOG,
    "",
    "Knowledge corpus the agent will reference:",
    args.digest,
    "",
    "User's stated wish (highest priority — override your own inference if conflicting):",
    args.userPromptHint?.trim() || "(none — infer purely from the corpus)",
    "",
    "Return ONLY this JSON shape, no prose, no markdown:",
    "{",
    '  "name":              string ≤200 chars,',
    '  "goal":              string ≤500 chars (one sentence, action-oriented),',
    '  "systemPromptExtra": string ≤2000 chars (operating principles, NOT a re-statement of the goal),',
    '  "toolSlugs":         string[] (subset of the enum above; ALWAYS include "search_knowledge"),',
    '  "reasoning":         string ≤300 chars (why these tools?)',
    "}",
  ].join("\n");
}
