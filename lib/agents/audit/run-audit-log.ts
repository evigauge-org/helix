import { prisma } from "@/lib/prisma";

export async function createRunAuditLog(args: {
  runId: string;
  agentId: string;
  userId: string;
  templateSlug?: string | null;
  templateVersion?: number | null;
  startedAt: Date;
  finishedAt: Date;
  status: string;
  knowledgeSourceIds: string[];
  toolCallCount: number;
  outputDigest: string | null;
  reviewStatus: string;
}): Promise<void> {
  await prisma.agentRunAuditLog.create({
    data: {
      runId: args.runId,
      agentId: args.agentId,
      userId: args.userId,
      templateSlug: args.templateSlug ?? null,
      templateVersion: args.templateVersion ?? null,
      startedAt: args.startedAt,
      finishedAt: args.finishedAt,
      status: args.status,
      knowledgeSourceIds: args.knowledgeSourceIds,
      toolCallCount: args.toolCallCount,
      outputDigest: args.outputDigest,
      reviewStatus: args.reviewStatus,
    },
  });
}

export async function updateRunAuditLogOnDecision(args: {
  runId: string;
  reviewStatus: string;
  approverId: string;
  decisionAt: Date;
}): Promise<void> {
  await prisma.agentRunAuditLog.updateMany({
    where: { runId: args.runId },
    data: {
      reviewStatus: args.reviewStatus,
      approverId: args.approverId,
      decisionAt: args.decisionAt,
    },
  });
}
