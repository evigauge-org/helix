import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { autoPopulate } from "@/lib/agents/auto-populate/dispatch";
import { prisma } from "@/lib/prisma";

const SPEC_PROMPT = (msg: string) => `The user asked to create an autonomous agent. Two paths:

PATH A — TEMPLATE: If the request CLEARLY matches one of these pre-built templates, return ONLY:
{"templateSlug":"<slug>","name":"short human name (override if user gave one)","goal":"one paragraph goal in user's own words"}

Available templates (match conservatively — only when intent is unambiguous):
- "kyc-screener" — Parse onboarding documents (UBO declarations, IDs, sanctions/PEP), screen entities, flag gaps for compliance.
- "earnings-reviewer" — Read earnings transcripts/filings, compute YoY/beat-miss, draft analyst note for research lead.
- "gl-reconciler" — Reconcile GL trial balance vs sub-ledgers, find variances, propose journal entries (never posted).
- "statement-auditor" — Audit financial statements (B/S, P&L, CF) for consistency + audit-readiness, produce findings memo.

PATH B — CUSTOM: If the request does not clearly match any template, return ONLY:
{"name":"short human name, 2-6 words","goal":"one paragraph goal","suggestedTools":["slug1","slug2"],"rationale":"one sentence why these tools"}

Available custom tools: web_search, fetch_url, llm_reason, save_artifact, send_email, post_to_chat, run_code, create_enterprise_report, write_rows, get_spreadsheet, find_spreadsheet, get_market_price, get_option_chain, update_dashboard, download_file, download_nse_report, create_canva_presentation, create_pptx, import_canva_from_file, create_canva_design, get_canva_design_metadata, list_canva_designs, llm_debate, create_docx

Note on run_code: use it whenever the agent needs to compute, fetch URLs programmatically, simulate, run statistics, or test. Python or JavaScript in a sandbox. Pair with knowledge tools for data-heavy tasks.

Be CONSERVATIVE about template matching — only match when intent is unambiguous (e.g. "GL reconciliation", "KYC screening", "earnings review for AAPL", "audit these financial statements"). When in doubt, return PATH B.

Message: "${msg}"

Return ONLY one of the two JSON shapes. No markdown, no prose, no code fences.`;

const TEMPLATE_SLUGS = new Set(["kyc-screener", "earnings-reviewer", "gl-reconciler", "statement-auditor"]);

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const userId = session.user.id;

  const body = await req.json();
  const { userMessage } = body;
  const draftToken: string | undefined =
    typeof body?.draftToken === "string" && body.draftToken.trim() ? body.draftToken : undefined;
  if (typeof userMessage !== "string" || !userMessage.trim()) return new Response("Bad request", { status: 400 });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return Response.json({ error: "openrouter not configured" }, { status: 500 });

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "anthropic/claude-haiku-4.5",
      messages: [{ role: "user", content: SPEC_PROMPT(userMessage) }],
      max_tokens: 400,
      temperature: 0.2,
    }),
  });
  if (!res.ok) return Response.json({ error: `upstream ${res.status}` }, { status: 502 });
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content ?? "";
  const cleaned = raw.replace(/```json?/g, "").replace(/```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);

    // PATH A — template match. Validate slug, return early; the AgentSpecCard
    // renders a "Powered by template" banner and the /api/agents POST will
    // prefill name/goal/toolSlugs/systemPrompt from the template row.
    const proposedSlug = typeof parsed.templateSlug === "string" ? parsed.templateSlug.trim() : "";
    if (proposedSlug && TEMPLATE_SLUGS.has(proposedSlug)) {
      // Pull the actual template name + goal so the spec card defaults match
      // what the user will see on the gallery card.
      const tpl = await prisma.agentTemplate.findUnique({
        where: { slug: proposedSlug },
        select: { name: true, goal: true, reviewerRoleHint: true },
      });
      const spec: {
        name: string;
        goal: string;
        suggestedTools: string[];
        rationale: string;
        templateSlug: string;
        systemPromptExtra?: string;
      } = {
        templateSlug: proposedSlug,
        name: String(parsed.name ?? tpl?.name ?? proposedSlug).slice(0, 100),
        goal: String(parsed.goal ?? tpl?.goal ?? "").slice(0, 4000),
        // Tools come from the template — leave empty here; the /api/agents
        // POST handler will fill from defaultToolSlugs when templateSlug is set.
        suggestedTools: [],
        rationale: tpl?.reviewerRoleHint
          ? `Matched template "${proposedSlug}" — output staged for ${tpl.reviewerRoleHint}.`
          : `Matched template "${proposedSlug}".`,
      };
      return Response.json(spec);
    }

    // PATH B — custom spec. Existing flow.
    const validTools = new Set([
      "web_search", "fetch_url", "llm_reason",
      "save_artifact", "send_email", "post_to_chat",
      "search_knowledge",
      "run_code",
      "create_enterprise_report", "write_rows", "get_spreadsheet", "find_spreadsheet",
      "get_market_price", "get_option_chain", "update_dashboard",
      "download_file", "download_nse_report",
      "create_canva_presentation", "create_pptx", "import_canva_from_file",
      "create_canva_design", "get_canva_design_metadata", "list_canva_designs",
      "llm_debate", "create_docx",
    ]);
    const spec: {
      name: string;
      goal: string;
      suggestedTools: string[];
      rationale: string;
      systemPromptExtra?: string;
    } = {
      name: String(parsed.name ?? "Untitled Agent").slice(0, 100),
      goal: String(parsed.goal ?? "").slice(0, 4000),
      suggestedTools: Array.isArray(parsed.suggestedTools)
        ? parsed.suggestedTools.filter((s: unknown) => typeof s === "string" && validTools.has(s as string))
        : [],
      rationale: String(parsed.rationale ?? "").slice(0, 500),
    };

    // Optional: if a knowledge-source draftToken was provided, run auto-populate
    // over its ready sources and merge any auto-derived values into empty slots
    // of the existing spec. The chat-derived spec wins for any non-empty field.
    let auto: Awaited<ReturnType<typeof autoPopulate>> | null = null;
    if (draftToken) {
      const sources = await prisma.agentKnowledgeSource.findMany({
        where: { draftToken, userId, status: "ready" },
        orderBy: { createdAt: "asc" },
      });
      if (sources.length > 0) {
        try {
          auto = await autoPopulate({
            userId,
            sources,
            userPromptHint: userMessage,
          });
        } catch (err) {
          console.warn("[spec-from-chat] auto-populate failed:", err);
        }
      }
    }

    if (auto) {
      const isEmpty = (s: string) => !s || !s.trim() || s === "Untitled Agent";
      if (isEmpty(spec.name) && auto.name) spec.name = auto.name.slice(0, 100);
      if (isEmpty(spec.goal) && auto.goal) spec.goal = auto.goal.slice(0, 4000);
      if (auto.systemPromptExtra && auto.systemPromptExtra.trim()) {
        spec.systemPromptExtra = auto.systemPromptExtra;
      }
      const allowedAutoTools = (auto.toolSlugs ?? []).filter((s) => validTools.has(s));
      spec.suggestedTools = Array.from(new Set([...(spec.suggestedTools ?? []), ...allowedAutoTools]));
    }

    return Response.json(spec);
  } catch {
    return Response.json({ error: "failed to parse model output" }, { status: 502 });
  }
}
