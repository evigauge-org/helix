// lib/agents/tools/run_code.ts
import { z } from "zod";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/lib/prisma";
import type { ToolDef, ToolContext, ToolResult } from "../types";
import { getE2BApiKey } from "./sandbox/client";
import { getOrCreateRunSandbox, closeRunSandbox } from "./sandbox/registry";
import { ChunkBuffer } from "./sandbox/stream-buffer";

const STDOUT_CAP = 8 * 1024;  // 8 KB
const STDERR_CAP = 4 * 1024;  // 4 KB

const schema = z.object({
  code: z.string().min(1),
  language: z.enum(["python", "javascript"]).default("python"),
  timeout_seconds: z.number().int().positive().max(300).default(60),
});

/**
 * Truncate a streamed string to a soft cap, appending an explicit
 * suffix so the LLM knows it's a partial view.
 */
function truncate(s: string, cap: number): string {
  if (s.length <= cap) return s;
  return s.slice(0, cap) + `\n…[truncated, total ${s.length} chars]`;
}

/**
 * E2B Result objects can carry rich payloads (charts, images, JSON).
 * We summarize them for the LLM so we don't leak megabytes of base64
 * into the chat context. Text-typed results pass through their content;
 * binaries get a one-line type+size summary.
 */
function summarizeResult(r: unknown): { type: string; preview?: string } {
  const obj = (r ?? {}) as Record<string, unknown>;
  if (typeof obj.text === "string") return { type: "text", preview: obj.text.slice(0, 1024) };
  if (typeof obj.html === "string") return { type: "html", preview: `html ${obj.html.length} chars` };
  if (typeof obj.json !== "undefined") {
    let p = "";
    try { p = JSON.stringify(obj.json).slice(0, 1024); } catch { p = "[unserializable json]"; }
    return { type: "application/json", preview: p };
  }
  if (typeof obj.png === "string") return { type: "image/png", preview: `png ${obj.png.length} chars (base64)` };
  if (typeof obj.svg === "string") return { type: "image/svg", preview: `svg ${obj.svg.length} chars` };
  return { type: "unknown" };
}

export const runCodeTool: ToolDef<typeof schema> = {
  slug: "run_code",
  description:
    "Execute Python or JavaScript in a secure E2B sandbox. State (files, installed packages) " +
    "persists across calls in the same run. Use '!pip install <pkg>' as the first line of a " +
    "Python cell to install packages, or `subprocess.run([...])` for one-off shell. Default " +
    "timeout is 60 s; raise via timeout_seconds (max 300). Output streams to the run timeline.",
  schema,
  // NOT requiresApproval — the sandbox is isolated, no binding external action.
  async execute(ctx: ToolContext, args: z.infer<typeof schema>): Promise<ToolResult> {
    // 1. API key precondition
    if (!getE2BApiKey()) {
      return {
        ok: false,
        error: "E2B not configured. Set E2B_API_KEY in env.",
      };
    }

    // 2. Per-agent lifetime cap
    const agent = await prisma.agent.findUnique({
      where: { id: ctx.agentId },
      select: { maxCodeExecutionsLifetime: true },
    });
    const cap = agent?.maxCodeExecutionsLifetime ?? 200;
    const used = await prisma.agentStep.count({
      where: {
        kind: "code_execution",
        run: { agentId: ctx.agentId },
      },
    });
    if (used >= cap) {
      return {
        ok: false,
        error: `code-execution lifetime cap (${cap}) reached for this agent`,
      };
    }

    // 3. Boot or reuse sandbox
    const callId = createId();
    const startedAt = Date.now();
    let sandbox;
    try {
      sandbox = await getOrCreateRunSandbox(ctx.runId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Write a code_execution row so the failure shows in the audit log.
      if (ctx.writeStep) {
        await ctx.writeStep("code_execution", {
          callId,
          language: args.language,
          code: args.code,
          stdout_preview: "",
          stderr_preview: "",
          result_count: 0,
          runtime_ms: Date.now() - startedAt,
          has_error: true,
          boot_error: msg,
        });
      }
      return { ok: false, error: `sandbox boot failed: ${msg}` };
    }

    // 4. Streamed execution
    let stdoutFull = "";
    let stderrFull = "";
    const buffer = new ChunkBuffer({
      flushIntervalMs: 250,
      maxBytesBeforeFlush: 1024,
      onFlush: async (channel, chunk) => {
        if (!ctx.writeStep) return;
        await ctx.writeStep(
          channel === "stdout" ? "code_stdout" : "code_stderr",
          { callId, chunk },
        );
      },
    });

    try {
      // E2B's onStdout/onStderr callbacks receive an OutputMessage with .line
      // (the output text). The instance also has .timestamp / .error which we
      // don't need here.
      const exec = await sandbox.runCode(args.code, {
        language: args.language,
        timeoutMs: args.timeout_seconds * 1000,
        onStdout: (output) => {
          const line = output.line;
          stdoutFull += line;
          buffer.push("stdout", line);
        },
        onStderr: (output) => {
          const line = output.line;
          stderrFull += line;
          buffer.push("stderr", line);
        },
      });

      // Drain any partial chunk so the timeline shows the tail.
      await buffer.flush();

      const runtime_ms = Date.now() - startedAt;
      const results = Array.isArray(exec.results) ? exec.results.map(summarizeResult) : [];
      const error = exec.error
        ? {
            name: String(exec.error.name ?? "Error"),
            value: String(exec.error.value ?? ""),
            traceback: typeof exec.error.traceback === "string" ? exec.error.traceback : undefined,
          }
        : undefined;

      // Write the summary row (full code, truncated previews).
      if (ctx.writeStep) {
        await ctx.writeStep("code_execution", {
          callId,
          language: args.language,
          code: args.code,
          stdout_preview: stdoutFull.slice(0, 1024),
          stderr_preview: stderrFull.slice(0, 512),
          result_count: results.length,
          runtime_ms,
          has_error: Boolean(error),
        });
      }

      return {
        ok: true,
        data: {
          stdout: truncate(stdoutFull, STDOUT_CAP),
          stderr: truncate(stderrFull, STDERR_CAP),
          results,
          error,
          runtime_ms,
          language: args.language,
        },
      };
    } catch (e) {
      // Sandbox died mid-call, or the SDK threw for some other reason.
      const msg = e instanceof Error ? e.message : String(e);
      await buffer.flush();
      // Drop the dead sandbox from the registry so the next call boots fresh.
      await closeRunSandbox(ctx.runId);
      if (ctx.writeStep) {
        await ctx.writeStep("code_execution", {
          callId,
          language: args.language,
          code: args.code,
          stdout_preview: stdoutFull.slice(0, 1024),
          stderr_preview: stderrFull.slice(0, 512),
          result_count: 0,
          runtime_ms: Date.now() - startedAt,
          has_error: true,
          sandbox_error: msg,
        });
      }
      return { ok: false, error: `sandbox lost: ${msg}` };
    }
  },
};
