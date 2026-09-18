// lib/agents/tools/modify-own-prompt.ts
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { ToolDef, ToolContext, ToolResult } from "../types";
import { emitAepEvent } from "@/lib/aep/events";
import { newAepId } from "@/lib/aep/ids";

const schema = z.object({
  mode: z.enum(["replace", "diff"]),
  content: z.string(),
  reason: z.string().min(1),
});

function computeDiff(before: string, after: string): string {
  // Minimal unified-diff-ish line output. Good enough for audit; consumers can apply a real diff tool if needed.
  const b = before.split("\n"), a = after.split("\n");
  const lines: string[] = [];
  const max = Math.max(b.length, a.length);
  for (let i = 0; i < max; i++) {
    const bl = b[i] ?? "";
    const al = a[i] ?? "";
    if (bl === al) continue;
    if (bl) lines.push(`- ${bl}`);
    if (al) lines.push(`+ ${al}`);
  }
  return lines.join("\n");
}

export const modifyOwnPromptTool: ToolDef = {
  slug: "modify_own_prompt",
  description: "Modify this agent's mutable_prompt. Behavior depends on constitution.mutable_prompt_policy.",
  schema,
  async execute(ctx: ToolContext, rawArgs: unknown): Promise<ToolResult> {
    const args = schema.parse(rawArgs);
    const a = await prisma.agent.findUnique({ where: { id: ctx.agentId } });
    if (!a) return { ok: false, error: "agent missing" };
    const before = a.constitutionMutable ?? a.systemPromptExtra ?? "";
    const proposed = args.mode === "replace" ? args.content : await applyDiff(before, args.content);
    const diff = computeDiff(before, proposed);

    const latestRun = await prisma.agentRun.findFirst({ where: { agentId: a.id }, orderBy: { startedAt: "desc" } });

    if (a.constitutionPolicy === "locked") {
      return { ok: false, error: "constitution_policy_violation: mutable_prompt is locked" };
    }
    if (a.constitutionPolicy === "approval_required") {
      const pending = await prisma.aepPendingPromptChange.create({
        data: {
          aepId: newAepId("pch"),
          agentId: a.id,
          proposedDiff: diff,
          proposedContent: proposed,
          mode: args.mode,
          reason: args.reason,
        },
      });
      if (latestRun) {
        await emitAepEvent(latestRun.id, "prompt.change_queued", { pending_change_id: pending.aepId, diff, reason: args.reason });
      }
      return { ok: true, data: { queued: true, pending_change_id: pending.aepId } };
    }
    // auto
    const phe = await prisma.$transaction(async (tx) => {
      await tx.agent.update({ where: { id: a.id }, data: { constitutionMutable: proposed, systemPromptExtra: proposed } });
      return tx.aepPromptHistoryEntry.create({
        data: { aepId: newAepId("phe"), agentId: a.id, diff, reason: args.reason, status: "applied" },
      });
    });
    if (latestRun) {
      await emitAepEvent(latestRun.id, "prompt.modified", { diff, reason: args.reason, approved_by: null });
    }
    return { ok: true, data: { applied: true, history_entry_id: phe.aepId } };
  },
};

async function applyDiff(before: string, _diff: string): Promise<string> {
  // v1: "diff" mode requires clients to provide the full resolved content; we accept it as-is.
  // Future: integrate a real unified-diff applier.
  return _diff;
}
