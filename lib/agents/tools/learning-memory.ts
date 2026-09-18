// lib/agents/tools/learning-memory.ts
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { memoryRead, memoryWrite, memoryDelete } from "@/lib/aep/handlers/memory";
import { AEP_WILDCARD } from "@/lib/aep/authz/scopes";
import { writeMemoryAuditEvent, memoryScope } from "@/lib/agents/audit/memory-event";
import type { ToolDef, ToolContext, ToolResult } from "../types";

// Runner-internal AEP context: the runner runs server-side as the user, so
// it carries the wildcard scope. authMethod=session reflects "trusted UI/server",
// not an api-key. See Plan 3 Task 9.
const RUNNER_BASE_CTX = {
  sessionId: null,
  negotiatedCapabilities: { "self.learning_memory": true },
  protocolVersion: null,
  scopes: [AEP_WILDCARD],
  authMethod: "session" as const,
};

const writeSchema = z.object({
  namespace: z.string(),
  key: z.string(),
  value: z.unknown(),
  subject_id: z.string().optional(),
  ttl_seconds: z.number().int().positive().optional(),
});
const readSchema = z.object({
  namespace: z.string(),
  key: z.string().optional(),
  limit: z.number().int().positive().optional(),
  cursor: z.string().optional(),
});

async function resolveCtx(agentId: string) {
  const a = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!a) throw new Error("agent missing");
  return {
    userId: a.userId,
    treeRootId: a.rootAgentId!,
    templateSlug: a.templateSlug ?? null,
  };
}

// PII scanner — opt-in per template (KYC defaults on). Catches a small set of
// high-confidence patterns; LLM-based classification deferred to v1.1. Blocked
// writes get an AuditMemoryEvent op:"write_blocked" with reason:"pii_detected".
const PII_PATTERNS: RegExp[] = [
  /\b\d{3}-\d{2}-\d{4}\b/,                // US SSN
  /\b[A-Z]{1,2}\d{6,9}\b/,                // passport-ish
  /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/, // IBAN-ish
  /\b\d{12,16}\b/,                        // generic ID-number-ish
];
function containsLikelyPII(s: string): boolean {
  return PII_PATTERNS.some((p) => p.test(s));
}

async function isPiiScannerEnabled(templateSlug: string | null): Promise<boolean> {
  if (!templateSlug) return false;
  const tpl = await prisma.agentTemplate.findUnique({
    where: { slug: templateSlug },
    select: { selfImprovementPolicyJson: true },
  });
  const pol = (tpl?.selfImprovementPolicyJson ?? null) as
    | { learningMemory?: { piiScanner?: boolean } }
    | null;
  return Boolean(pol?.learningMemory?.piiScanner);
}

export const learningMemoryWriteTool: ToolDef = {
  slug: "learning_memory_write",
  description: "Write a learning memory record scoped to this agent's tree root.",
  schema: writeSchema,
  async execute(ctx: ToolContext, rawArgs: unknown): Promise<ToolResult> {
    const args = writeSchema.parse(rawArgs);
    const { userId, treeRootId, templateSlug } = await resolveCtx(ctx.agentId);

    if (await isPiiScannerEnabled(templateSlug)) {
      const stringified = typeof args.value === "string" ? args.value : JSON.stringify(args.value ?? "");
      if (containsLikelyPII(stringified)) {
        await writeMemoryAuditEvent({
          runId: ctx.runId,
          agentId: ctx.agentId,
          userId,
          op: "write_blocked",
          scope: memoryScope({ templateSlug, userId, agentId: ctx.agentId }),
          key: args.key,
          reason: "pii_detected",
        });
        return { ok: false, error: "memory write blocked: value matched PII patterns" };
      }
    }

    const rec = await memoryWrite(
      { tree_root_id: treeRootId, ...args } as never,
      { userId, ...RUNNER_BASE_CTX },
    );

    await writeMemoryAuditEvent({
      runId: ctx.runId,
      agentId: ctx.agentId,
      userId,
      op: "write",
      scope: memoryScope({ templateSlug, userId, agentId: ctx.agentId }),
      key: args.key,
      value: args.value,
    });

    return { ok: true, data: rec };
  },
};

export const learningMemoryReadTool: ToolDef = {
  slug: "learning_memory_read",
  description: "Read learning memory records scoped to this agent's tree root.",
  schema: readSchema,
  async execute(ctx: ToolContext, rawArgs: unknown): Promise<ToolResult> {
    const args = readSchema.parse(rawArgs);
    const { userId, treeRootId, templateSlug } = await resolveCtx(ctx.agentId);
    const res = await memoryRead(
      { tree_root_id: treeRootId, ...args } as never,
      { userId, ...RUNNER_BASE_CTX },
    );
    await writeMemoryAuditEvent({
      runId: ctx.runId,
      agentId: ctx.agentId,
      userId,
      op: "read",
      scope: memoryScope({ templateSlug, userId, agentId: ctx.agentId }),
      key: args.key ?? `(namespace:${args.namespace})`,
    });
    return { ok: true, data: res };
  },
};

export const learningMemoryDeleteTool: ToolDef = {
  slug: "learning_memory_delete",
  description: "Delete learning memory record(s) scoped to this agent's tree root.",
  schema: z.object({ id: z.string().optional(), namespace: z.string().optional() }),
  async execute(ctx: ToolContext, rawArgs: unknown): Promise<ToolResult> {
    const args = rawArgs as { id?: string; namespace?: string };
    const { userId, treeRootId, templateSlug } = await resolveCtx(ctx.agentId);
    const res = await memoryDelete(
      { tree_root_id: treeRootId, ...args },
      { userId, ...RUNNER_BASE_CTX },
    );
    await writeMemoryAuditEvent({
      runId: ctx.runId,
      agentId: ctx.agentId,
      userId,
      op: "delete",
      scope: memoryScope({ templateSlug, userId, agentId: ctx.agentId }),
      key: args.id ?? args.namespace ?? "(unspecified)",
    });
    return { ok: true, data: res };
  },
};
