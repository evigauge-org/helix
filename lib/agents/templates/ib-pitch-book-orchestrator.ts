// lib/agents/templates/ib-pitch-book-orchestrator.ts
import { z } from "zod";
import type { AgentTemplateConfig } from "./types";

const orchestratorOutputSchema = z.object({
  runSummary: z.string(),
  pptxPath: z.string(),
  xlsxPath: z.string(),
  recommendedCounterparty: z.string(),
  citationCount: z.number(),
});

export const ibPitchBookOrchestratorTemplate: AgentTemplateConfig = {
  slug: "ib-pitch-book-orchestrator",
  name: "IB Pitch Book Orchestrator",
  category: "research",
  iconName: "BookOpen",
  goal: "Produce a complete M&A advisory pitch book — 30-slide PPTX + 9-sheet XLSX — with per-section reviewer approval at every stage.",
  description:
    "Orchestrates 7 specialized sub-agents (target profile, acquirer screener, 8 parallel acquirer deep-dives, comp transactions, competitive landscape, valuation, recommendation) and assembles the final deliverables. Reviewer approves each section before assembly.",
  defaultToolSlugs: [
    "spawn_subagent",
    "replicate",
    "search_knowledge",
    "assemble_ib_pitch_book",
    "post_to_chat",
    "llm_reason",
  ],
  systemPromptBase: `You are the IB Pitch Book Orchestrator. You coordinate a team of specialized sub-agents to produce a complete pitch book for an M&A advisory mandate.

Workflow:

ENTRY MODES:
- If the user pasted 8 acquirer names/tickers up front, you are in "paste mode" — skip the screener sub-agent.
- Otherwise you are in "screen mode".

STEP 1 — TARGET PROFILE
spawn_subagent(template="ib-target-profile", input={target_query, uploads}) — produces target profile section.
Wait for reviewer approval before proceeding.

STEP 2 — ACQUIRER UNIVERSE (skip if paste mode)
spawn_subagent(template="ib-acquirer-screener", input={target_profile, strategic_objective}).
Reviewer picks 8 from the candidates surfaced.

STEP 3 — ACQUIRER DEEP-DIVES (parallel × 8)
replicate({fanout: 8}, template="ib-acquirer-deep-dive", inputsPerInstance=[acquirer_name × 8 + target_context]).
Each spawn produces one review card.

STEP 4 — PARALLEL ANALYTICS (after deep-dives complete)
spawn_subagent(template="ib-comp-transactions", input={target_sector, target_ev_estimate}).
spawn_subagent(template="ib-competitive-landscape", input={target_profile, sector_uploads}).
spawn_subagent(template="ib-valuation", input={target_profile, comp_txns, trading_comps}).
Wait for all three to be reviewer-approved.

STEP 5 — RECOMMENDATION (mandatory llm_debate)
spawn_subagent(template="ib-recommendation", input={target, all_8_deep_dives, comp_txns, valuation, landscape}).
Wait for reviewer approval.

STEP 6 — ASSEMBLY
Call assemble_ib_pitch_book with all collected sub-agent outputs.
Wait for FINAL reviewer approval on the deliverables.

STEP 7 — DELIVERY
post_to_chat with the PPTX path + XLSX path + recommended counterparty + citation count.

INVARIANTS:
- Never produce content yourself for any sub-agent's section. You only orchestrate.
- Every spawn writes its own AgentRunReview row (existing requiresApproval machinery on each sub-agent's output).
- The final assembly is review-gated — you do not call assemble_ib_pitch_book until every input section has approval.`,
  outputSchema: orchestratorOutputSchema,
  docPolicy: "optional",
  docChecklist: [
    { label: "Target CIM (if seller-side)", exampleFormats: [".pdf"] },
    { label: "Latest 10-K / annual report", exampleFormats: [".pdf"] },
    { label: "Industry / sector report", exampleFormats: [".pdf"] },
    { label: "Prior pitch book (for style reference)", exampleFormats: [".pdf", ".pptx"] },
  ],
  reviewerRoleHint: "M&A analyst lead",
  selfImprovementPolicy: {
    learningMemory:  { enabled: true, scope: "template+user", piiScanner: true },
    modifyOwnPrompt: { enabled: true, autoPromote: false },
    spawnSubagent:   { enabled: true, maxDepth: 3 },
    replicate:       { enabled: true, maxFanout: 25 },
  },
  version: 1,
};
