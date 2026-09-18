import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";
import { z } from "zod";
// The runner resolves ToolDef.execute directly on its hot path. The same
// tools are also exposed under an MCP-style contract via
// `lib/aep/mcp/local.ts` (localMcp.listTools / localMcp.callTool) for
// external callers (AEP send_message, future Path-B remote MCP). Keep these
// two paths behaviorally equivalent — localMcp is a thin forwarder over the
// same registry.
import { getToolsForAgent, resolveAgentToolsForRun, toolRegistry } from "./tool-registry";
import { buildSystemPrompt } from "./prompt";
import { makeToolContext } from "./tool-context";
import { CycleEndSignal } from "./tools/control";
import { closeRunSandbox } from "./tools/sandbox/registry";
import type { AgentCycleOutcome } from "./types";
import { emitAepEvent } from "@/lib/aep/events";
import { dispatchChat, resolveAgentLlmConfig } from "./llm/dispatch";
import { AdapterError, type ChatMessage } from "./llm/types";
import { getTemplateConfig } from "@/lib/agents/templates";
import { validateOutput, buildCorrectivePrompt } from "@/lib/agents/review/output-schema-validator";
import { outputDigest } from "@/lib/agents/review/digest";
import { createRunAuditLog } from "@/lib/agents/audit/run-audit-log";
// Side-effect import: registers all tools before the runner uses the registry.
import "./tools/register-all";

// Best-effort AEP event emit: telemetry must never abort a cycle.
function emitAep(runId: string, type: Parameters<typeof emitAepEvent>[1], payload: unknown) {
  void emitAepEvent(runId, type, payload).catch((err) => {
    console.warn(`[aep] emit ${type} failed for run ${runId}:`, err);
  });
}

// Summarize a tool result for the `tool.returned` event payload. Truncates
// to keep event rows small; tolerates circular refs and non-JSON values.
function summarizeToolResult(result: unknown): { ok: boolean; preview: string } {
  let ok = true;
  if (result && typeof result === "object" && "ok" in (result as Record<string, unknown>)) {
    ok = Boolean((result as { ok?: unknown }).ok);
  }
  let preview: string;
  try {
    preview = JSON.stringify(result);
  } catch {
    preview = String(result);
  }
  if (typeof preview !== "string") preview = String(preview);
  if (preview.length > 500) preview = preview.slice(0, 500) + "...";
  return { ok, preview };
}

// One-line markdown summary rendered on the chat review card and the
// /reviews inbox row. Per-template; falls back to null for untemplated.
function buildOutputSummaryForCard(templateSlug: string | null, output: unknown): string | null {
  if (!templateSlug || typeof output !== "object" || output === null) return null;
  const o = output as Record<string, unknown>;
  switch (templateSlug) {
    case "kyc-screener": {
      const risk = (o.riskAssessment as { tier?: string } | undefined)?.tier ?? "unknown";
      const gaps = Array.isArray(o.gaps) ? o.gaps.length : 0;
      return `Risk tier: ${risk.toUpperCase()} · ${gaps} gap${gaps === 1 ? "" : "s"}`;
    }
    case "earnings-reviewer": {
      const t = (o.thesisImpact as { rating?: string } | undefined)?.rating ?? "neutral";
      return `Thesis impact: ${t}`;
    }
    case "gl-reconciler": {
      const s = o.summary as { totalBreaks?: number; materialBreaks?: number } | undefined;
      return `${s?.totalBreaks ?? 0} break${(s?.totalBreaks ?? 0) === 1 ? "" : "s"} · ${s?.materialBreaks ?? 0} material`;
    }
    case "statement-auditor": {
      const score = typeof o.auditReadinessScore === "number" ? o.auditReadinessScore : null;
      const findings = Array.isArray(o.findings) ? o.findings.length : 0;
      return `${findings} finding${findings === 1 ? "" : "s"} · readiness ${score ?? "—"}/100`;
    }
    default:
      return null;
  }
}

// Pull the citations array out of the structured output (templates that
// produce one put it under `sources`). Returns null when not present.
function extractCitations(output: unknown): unknown {
  if (!output || typeof output !== "object") return null;
  const o = output as Record<string, unknown>;
  if (Array.isArray(o.sources)) return o.sources;
  return null;
}

const TERMINAL = new Set(["stopped", "completed", "expired", "aborted"]);

export async function runOneCycle(params: {
  agentId: string;
  runId: string;
  tickNumber: number;
}): Promise<AgentCycleOutcome> {
  const { agentId, runId, tickNumber } = params;

  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  const run = await prisma.agentRun.findUnique({ where: { id: runId } });
  if (!agent || !run) return { kind: "stopped_mid_cycle" };
  if (TERMINAL.has(run.status)) return { kind: "stopped_mid_cycle" };

  await prisma.agentRun.update({
    where: { id: runId },
    data: {
      status: "active",
      currentTickStartedAt: new Date(),
      tickCount: { increment: 1 },
    },
  });

  // Plan 5: tools = built-in (Helix ToolDefs selected via toolSlugs) + remote
  // tools projected from external MCP servers attached to this agent. The
  // try/finally below wraps the rest of the cycle so MCP connections are
  // always closed at run end, regardless of which return path we hit.
  const __mcpHandles = await resolveAgentToolsForRun(agent.id);
  try {
  const tools = __mcpHandles.tools;
  // Snapshot the system prompt on the FIRST cycle and reuse on subsequent
  // ticks so that a Replay can reconstruct the exact bytes the agent saw.
  // The dynamic-date injection happens inside buildSystemPrompt at first-tick
  // time; capturing it once is the audit-grade contract: "this is what the
  // agent was told, with this date, throughout this run."
  let systemPrompt: string;
  if (run.systemPromptUsed) {
    systemPrompt = run.systemPromptUsed;
  } else {
    systemPrompt = await buildSystemPrompt({ agentId, tools });
    await prisma.agentRun.update({
      where: { id: runId },
      data: { systemPromptUsed: systemPrompt },
    });
  }
  const ctx = makeToolContext({ userId: agent.userId, agentId, runId, tickNumber });
  // Stream-aware tools (run_code) write AgentStep rows during execution.
  // Closure shares the cycle's stepNumber sequencing.
  ctx.writeStep = async (kind, payload) => {
    await writeStep(kind, payload as Record<string, unknown>);
  };

  const MAX_STEPS = agent.maxStepsPerCycle;
  const maxCycleMs = agent.maxCycleDurationSecs * 1000;
  const maxTokensPerCycle = agent.maxTokensPerCycle;

  // Emit cycle.started once the cycle is actually committed (status=active,
  // tickCount incremented). Use aepId when available; fall back to internal id.
  emitAep(runId, "cycle.started", {
    run_id: run.aepId ?? run.id,
    cycle_number: tickNumber,
    budget_snapshot: {
      tokens_per_cycle: maxTokensPerCycle,
      tool_calls_per_cycle: MAX_STEPS,
      seconds_per_cycle: agent.maxCycleDurationSecs,
    },
  });

  const messages: ChatMessage[] = [];
  let stepNumber = 0;
  let tokensThisCycle = 0;
  // Tracks input + output tokens across LLM calls in this cycle. Used solely
  // for the runaway-context guard: tokensThisCycle is output-only (billing),
  // so the per-cycle cap needs its own counter that includes input growth.
  let cycleContextTokens = 0;
  const startedAt = Date.now();

  const writeStep = async (
    kind: string,
    payload: Record<string, unknown>,
    extra?: { toolSlug?: string; tokensIn?: number; tokensOut?: number; durationMs?: number },
  ) => {
    stepNumber += 1;
    await prisma.agentStep.create({
      data: {
        runId,
        tickNumber,
        stepNumber,
        kind,
        toolSlug: extra?.toolSlug,
        payload: payload as object,
        tokensIn: extra?.tokensIn,
        tokensOut: extra?.tokensOut,
        durationMs: extra?.durationMs,
      },
    });
    await prisma.agentRun.update({
      where: { id: runId },
      data: { totalSteps: { increment: 1 } },
    });
  };

  const finalize = async (
    kind: "sleep" | "complete" | "continue_now",
    payload: Record<string, unknown>,
  ): Promise<AgentCycleOutcome> => {
    await writeStep("cycle_end", { kind, ...payload });

    if (kind === "sleep") {
      const raw = Number(payload.duration_seconds) || 300;
      const duration = Math.min(Math.max(raw, 60), 604800);
      const nextWakeAt = new Date(Date.now() + duration * 1000);
      const reason = typeof payload.reason === "string" ? payload.reason : "sleep";
      await prisma.agentRun.update({
        where: { id: runId },
        data: { status: "idle", nextWakeAt },
      });
      emitAep(runId, "cycle.ended", {
        run_id: run.aepId ?? run.id,
        cycle_number: tickNumber,
        tokens_used: tokensThisCycle,
        tool_calls_made: stepNumber,
        outcome: "slept",
      });
      return { kind: "slept", nextWakeAt, reason };
    }
    if (kind === "complete") {
      const finalMessage =
        typeof payload.final_message === "string" ? payload.final_message : "";
      const artifactIds = Array.isArray(payload.artifact_ids)
        ? (payload.artifact_ids as string[])
        : [];

      // Templated agents: validate finalMessage against the template's output
      // schema (single corrective re-prompt on first failure). Non-templated
      // agents skip this entire block.
      let validatedOutput: unknown = null;
      let outputIsValid = true;
      let schemaErrors: z.ZodIssue[] | undefined = undefined;
      const templateSlug = agent.templateSlug ?? null;

      if (templateSlug) {
        const tpl = getTemplateConfig(templateSlug);
        if (tpl) {
          const tryParse = (s: string): unknown => {
            const trimmed = s.trim();
            // Strip leading/trailing markdown code fences if present
            const stripped = trimmed
              .replace(/^```(?:json)?\s*\n?/i, "")
              .replace(/\n?```\s*$/, "");
            try { return JSON.parse(stripped); } catch { return s; }
          };
          let parsed = tryParse(finalMessage);
          let result = validateOutput(tpl.outputSchema, parsed);
          if (result.ok) {
            validatedOutput = result.value;
          } else {
            // ONE corrective re-prompt — surface the schema errors and ask
            // the LLM to return a corrected JSON. No tools on the retry.
            const corrective = buildCorrectivePrompt(result.errors);
            try {
              const retry = await dispatchChat(llmConfig, {
                messages: [
                  { role: "system", content: systemPrompt },
                  ...messages,
                  { role: "user", content: corrective },
                ] as ChatMessage[],
                tools: [],
                max_tokens: 32000,
                temperature: 0.4,
              });
              const retryText = typeof retry.content === "string" ? retry.content : "";
              const retryParsed = tryParse(retryText);
              const retryResult = validateOutput(tpl.outputSchema, retryParsed);
              if (retryResult.ok) {
                validatedOutput = retryResult.value;
              } else {
                outputIsValid = false;
                schemaErrors = retryResult.errors;
                validatedOutput = retryParsed;
              }
            } catch {
              outputIsValid = false;
              schemaErrors = result.errors;
              validatedOutput = parsed;
            }
          }
        }
      }

      await prisma.agentRun.update({
        where: { id: runId },
        data: {
          status: "completed",
          completedAt: new Date(),
          finalMessage,
        },
      });

      // For TEMPLATED agents: create AgentRunReview + AgentRunAuditLog and
      // suppress the post_to_chat call (the review card surfaces via the
      // /reviews inbox + per-agent Reviews tab; chat-originated reviews are
      // surfaced via the chat thread by a separate path in v1.1).
      if (templateSlug) {
        const gatedSteps = await prisma.agentStep.findMany({
          where: { runId, kind: "tool_gated" },
          select: { payload: true, toolSlug: true, createdAt: true },
        });
        const blockedToolCalls = gatedSteps.map((s) => {
          const p = (s.payload ?? {}) as { name?: string; args?: unknown; callId?: string; proposedAt?: string };
          return {
            toolSlug: s.toolSlug ?? p.name ?? "",
            args: p.args ?? null,
            proposedAt: p.proposedAt ?? s.createdAt.toISOString(),
            callId: p.callId ?? "",
          };
        });

        const reviewOutputJson =
          outputIsValid && validatedOutput !== null
            ? validatedOutput
            : { __schemaErrors: schemaErrors, raw: validatedOutput ?? finalMessage };

        const digest = outputDigest(reviewOutputJson);
        const summary = buildOutputSummaryForCard(templateSlug, validatedOutput);
        const citations = extractCitations(validatedOutput);

        await prisma.agentRunReview.create({
          data: {
            runId,
            agentId,
            templateSlug,
            templateVersion: agent.templateVersion ?? null,
            status: "pending",
            outputJson: reviewOutputJson as object,
            outputSummary: summary,
            citationsJson: (citations ?? undefined) as object | undefined,
            outputDigest: digest,
            blockedToolCallsJson: blockedToolCalls.length ? blockedToolCalls : undefined,
          },
        });

        await createRunAuditLog({
          runId,
          agentId,
          userId: agent.userId,
          templateSlug,
          templateVersion: agent.templateVersion ?? null,
          startedAt: run.startedAt,
          finishedAt: new Date(),
          status: outputIsValid ? "completed" : "output_invalid",
          knowledgeSourceIds: run.knowledgeSourceIds,
          toolCallCount: stepNumber,
          outputDigest: digest,
          reviewStatus: "pending",
        });
      } else if (finalMessage) {
        // Untemplated agents preserve the existing post_to_chat behavior.
        const postTool = toolRegistry.get("post_to_chat");
        if (postTool) {
          try {
            await postTool.execute(ctx, { markdown: finalMessage } as never);
          } catch (err) {
            ctx.log("post_to_chat failed", { err: String(err) });
          }
        }
      }

      emitAep(runId, "cycle.ended", {
        run_id: run.aepId ?? run.id,
        cycle_number: tickNumber,
        tokens_used: tokensThisCycle,
        tool_calls_made: stepNumber,
        outcome: "completed",
      });
      // Run reached terminal state inside runner.ts (not inngest): emit run.ended here.
      emitAep(runId, "run.ended", {
        run_id: run.aepId ?? run.id,
        final_state: "completed",
        result: { final_message: finalMessage, artifact_ids: artifactIds },
      });
      return { kind: "completed", finalMessage, artifactIds };
    }
    // continue_now
    await prisma.agentRun.update({
      where: { id: runId },
      data: { status: "pending" },
    });
    emitAep(runId, "cycle.ended", {
      run_id: run.aepId ?? run.id,
      cycle_number: tickNumber,
      tokens_used: tokensThisCycle,
      tool_calls_made: stepNumber,
      outcome: "continue",
    });
    return { kind: "continue" };
  };

  const forceSleep = async (reason: string): Promise<AgentCycleOutcome> => {
    const nextWakeAt = new Date(Date.now() + 5 * 60 * 1000);
    await writeStep("cycle_end", { kind: "forced_sleep", reason });
    await prisma.agentRun.update({
      where: { id: runId },
      data: { status: "idle", nextWakeAt },
    });
    emitAep(runId, "cycle.ended", {
      run_id: run.aepId ?? run.id,
      cycle_number: tickNumber,
      tokens_used: tokensThisCycle,
      tool_calls_made: stepNumber,
      outcome: "forced_sleep",
      reason,
    });
    return { kind: "forced_sleep", nextWakeAt, reason };
  };

  const llmConfig = await resolveAgentLlmConfig({
    runnerProviderId: agent.runnerProviderId ?? null,
    runnerModel: agent.runnerModel ?? null,
  });
  if (!llmConfig.model) {
    throw new Error(
      `Agent ${agent.id} has no resolvable model — set runnerModel or provider defaultModel`,
    );
  }

  try {
    while (true) {
      const freshRun = await prisma.agentRun.findUnique({
        where: { id: runId },
        select: { status: true },
      });
      if (!freshRun || freshRun.status === "stopped") {
        await writeStep("cycle_end", { reason: "stopped_by_user" });
        emitAep(runId, "cycle.ended", {
          run_id: run.aepId ?? run.id,
          cycle_number: tickNumber,
          tokens_used: tokensThisCycle,
          tool_calls_made: stepNumber,
          outcome: "stopped_mid_cycle",
          reason: "stopped_by_user",
        });
        emitAep(runId, "run.ended", {
          run_id: run.aepId ?? run.id,
          final_state: "stopped",
          result: { reason: "stopped_by_user" },
        });
        return { kind: "stopped_mid_cycle" };
      }

      if (stepNumber >= MAX_STEPS) return await forceSleep("max steps reached");
      if (Date.now() - startedAt > maxCycleMs)
        return await forceSleep("max cycle duration reached");
      if (cycleContextTokens >= maxTokensPerCycle)
        return await forceSleep("max tokens per cycle reached");

      const callStart = Date.now();
      let response;
      try {
        response = await dispatchChat(llmConfig, {
          messages: [{ role: "system", content: systemPrompt }, ...messages] as ChatMessage[],
          tools,
          // Large ceiling so tool-call JSON args (e.g. update_dashboard body_html,
          // create_enterprise_report multi-sheet payloads) don't get truncated
          // mid-string. Claude Haiku 4.5 supports up to 64K output; 32K is
          // enough for our heaviest tool calls without being wasteful.
          max_tokens: 32000,
          temperature: 0.4,
        });
      } catch (e) {
        if (e instanceof AdapterError) {
          await writeStep("think", { error: `${e.kind}: ${e.message}` });
          // auth_failed and model_invalid never self-heal — halt the run so
          // the user has to fix credentials/model before it can resume. Every
          // other AdapterError kind (rate_limited / upstream_error / unreachable
          // / parse_error / other) gets a forced sleep so the cycle backs off
          // rather than retrying tightly.
          if (e.kind === "auth_failed" || e.kind === "model_invalid") {
            const reason = `provider_${e.kind}`;
            await writeStep("cycle_end", { kind: "errored", reason, message: e.message });
            await prisma.agentRun.update({
              where: { id: runId },
              data: { status: "stopped" },
            });
            emitAep(runId, "cycle.ended", {
              run_id: run.aepId ?? run.id,
              cycle_number: tickNumber,
              tokens_used: tokensThisCycle,
              tool_calls_made: stepNumber,
              outcome: "stopped_mid_cycle",
              reason,
            });
            emitAep(runId, "run.ended", {
              run_id: run.aepId ?? run.id,
              final_state: "stopped",
              result: { reason, error_kind: e.kind, message: e.message },
            });
            return { kind: "stopped_mid_cycle" };
          }
          return await forceSleep(`provider_${e.kind}`);
        }
        throw e;
      }

      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      tokensThisCycle += outputTokens;
      cycleContextTokens += inputTokens + outputTokens;

      const toolCalls = response.tool_calls;
      const assistantContent = response.content ?? "";

      await writeStep(
        "think",
        { content: assistantContent, tool_call_count: toolCalls.length },
        {
          tokensIn: inputTokens,
          tokensOut: outputTokens,
          durationMs: Date.now() - callStart,
        },
      );

      if (!toolCalls.length) {
        if (assistantContent && assistantContent.trim().length > 0) {
          return await finalize("complete", {
            final_message: assistantContent,
            artifact_ids: [],
          });
        }
        return await forceSleep("empty response");
      }

      messages.push({
        role: "assistant",
        content: assistantContent,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      });

      let finalized: AgentCycleOutcome | null = null;

      for (const tc of toolCalls) {
        const name = tc.name;
        // NormalizedToolCall.arguments is already a parsed object: the
        // OpenAI-compat adapter does the JSON.parse internally and falls back
        // to `{ __raw: <string> }` on parse failure. The schema validation
        // below catches that case as a normal validation error.
        const args: Record<string, unknown> = tc.arguments;

        const tool = toolRegistry.get(name);
        if (!tool) {
          const err = `unknown tool: ${name}`;
          emitAep(runId, "tool.called", {
            cycle_number: tickNumber,
            tool_name: `helix.${name}`,
            args,
          });
          await writeStep("tool_call", { name, args }, { toolSlug: name });
          await writeStep("tool_result", { ok: false, error: err }, { toolSlug: name });
          emitAep(runId, "tool.returned", {
            cycle_number: tickNumber,
            tool_name: `helix.${name}`,
            result_summary: { ok: false, preview: err },
          });
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ ok: false, error: err }),
          });
          continue;
        }

        const parsed = tool.schema.safeParse(args);
        if (!parsed.success) {
          const err = `schema validation failed: ${parsed.error.message}`;
          emitAep(runId, "tool.called", {
            cycle_number: tickNumber,
            tool_name: `helix.${name}`,
            args,
          });
          await writeStep("tool_call", { name, args }, { toolSlug: name });
          await writeStep(
            "tool_result",
            { ok: false, error: err },
            { toolSlug: name },
          );
          emitAep(runId, "tool.returned", {
            cycle_number: tickNumber,
            tool_name: `helix.${name}`,
            result_summary: { ok: false, preview: err.slice(0, 500) },
          });
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ ok: false, error: err }),
          });
          continue;
        }

        emitAep(runId, "tool.called", {
          cycle_number: tickNumber,
          tool_name: `helix.${name}`,
          args: parsed.data,
        });
        await writeStep("tool_call", { name, args: parsed.data }, { toolSlug: name });

        // Gated-tool queueing: tools with requiresApproval are recorded in a
        // "tool_gated" AgentStep row and NOT executed. Review-creation at
        // cycle end aggregates these into AgentRunReview.blockedToolCallsJson;
        // post-approval dispatch (api/reviews/[id]/decide) replays them.
        if (tool.requiresApproval) {
          const callId = randomUUID();
          await writeStep(
            "tool_gated",
            { name, args: parsed.data, callId, proposedAt: new Date().toISOString() },
            { toolSlug: name },
          );
          emitAep(runId, "tool.returned", {
            cycle_number: tickNumber,
            tool_name: `helix.${name}`,
            result_summary: { ok: true, preview: `gated: ${name} queued — pending review approval` },
          });
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({
              ok: true,
              data: { queued: true, message: `${tool.slug} queued — pending review approval` },
            }),
          });
          continue;
        }

        const execStart = Date.now();
        try {
          const result = await tool.execute(ctx, parsed.data);
          await writeStep(
            "tool_result",
            { result: result as unknown as Record<string, unknown> },
            { toolSlug: name, durationMs: Date.now() - execStart },
          );
          emitAep(runId, "tool.returned", {
            cycle_number: tickNumber,
            tool_name: `helix.${name}`,
            result_summary: summarizeToolResult(result),
          });
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        } catch (err) {
          if (err instanceof CycleEndSignal) {
            // The control-flow tool (sleep/complete/continue_now) throws this
            // sentinel; treat it as a successful tool return before cycle ends.
            emitAep(runId, "tool.returned", {
              cycle_number: tickNumber,
              tool_name: `helix.${name}`,
              result_summary: { ok: true, preview: `cycle_end:${err.kind}` },
            });
            finalized = await finalize(err.kind, err.payload);
            break;
          }
          const msg = err instanceof Error ? err.message : String(err);
          await writeStep(
            "tool_result",
            { ok: false, error: `execution error: ${msg}` },
            { toolSlug: name, durationMs: Date.now() - execStart },
          );
          emitAep(runId, "tool.returned", {
            cycle_number: tickNumber,
            tool_name: `helix.${name}`,
            result_summary: { ok: false, preview: `execution error: ${msg}`.slice(0, 500) },
          });
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ ok: false, error: msg }),
          });
        }
      }

      if (finalized) return finalized;
    }
  } finally {
    if (tokensThisCycle > 0) {
      await prisma.agentRun
        .update({
          where: { id: runId },
          data: { totalTokens: { increment: tokensThisCycle } },
        })
        .catch(() => {});
    }
  }
  } finally {
    await __mcpHandles.closeAll();
    // No-op if this run never booted an E2B sandbox via run_code.
    await closeRunSandbox(runId);
  }
}
