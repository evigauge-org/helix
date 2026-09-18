import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type MemoryOp = "write" | "read" | "delete" | "write_blocked";

export async function writeMemoryAuditEvent(args: {
  runId: string;
  agentId: string;
  userId: string;
  op: MemoryOp;
  scope: string;
  key: string;
  value?: unknown;
  reason?: string;
}): Promise<void> {
  const valueDigest =
    args.value !== undefined
      ? createHash("sha256").update(JSON.stringify(args.value)).digest("hex")
      : null;
  await prisma.auditMemoryEvent.create({
    data: {
      runId: args.runId,
      agentId: args.agentId,
      userId: args.userId,
      op: args.op,
      scope: args.scope,
      key: args.key,
      valueDigest,
      reason: args.reason ?? null,
    },
  });
}

export function memoryScope(args: { templateSlug?: string | null; userId: string; agentId: string }): string {
  return `tpl:${args.templateSlug ?? "none"}|usr:${args.userId}|agt:${args.agentId}`;
}
