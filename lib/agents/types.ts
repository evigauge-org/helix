import type { z } from "zod";

export type ToolResult = { ok: true; data?: unknown } | { ok: false; error: string };

export type ToolContext = {
  userId: string;
  agentId: string;
  runId: string;
  tickNumber: number;
  log: (msg: string, meta?: Record<string, unknown>) => void;
  /**
   * Tools that need to write streaming AgentStep rows (e.g. run_code's
   * stdout/stderr chunks) get a closure over the runner's writeStep so
   * the rows share the cycle's tickNumber/stepNumber sequencing.
   * Optional — most tools ignore it.
   */
  writeStep?: (kind: string, payload: object) => Promise<void>;
};

export type ToolDef<S extends z.ZodTypeAny = z.ZodTypeAny> = {
  slug: string;
  description: string;
  schema: S;
  /**
   * If true, calls to this tool during a run with an unfinalized AgentRunReview
   * are recorded to AgentRunReview.blockedToolCallsJson and NOT executed.
   * The tool dispatches only after the review transitions to "approved".
   * Tools that take binding external actions (send email, post to external
   * systems, write to spreadsheets, etc.) MUST set this to true.
   */
  requiresApproval?: boolean;
  execute: (ctx: ToolContext, args: z.infer<S>) => Promise<ToolResult>;
};

export type AgentCycleOutcome =
  | { kind: "slept"; nextWakeAt: Date; reason: string }
  | { kind: "completed"; finalMessage: string; artifactIds: string[] }
  | { kind: "continue" }
  | { kind: "forced_sleep"; nextWakeAt: Date; reason: string }
  | { kind: "stopped_mid_cycle" };
