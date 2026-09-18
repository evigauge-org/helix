-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "systemPromptDraft" TEXT,
ADD COLUMN     "systemPromptSnapshot" JSONB,
ADD COLUMN     "templateSlug" TEXT,
ADD COLUMN     "templateVersion" INTEGER;

-- AlterTable
ALTER TABLE "AgentRun" ADD COLUMN     "knowledgeSourceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "memorySnapshotJson" JSONB,
ADD COLUMN     "modifyPromptProposed" TEXT,
ADD COLUMN     "parentRunId" TEXT,
ADD COLUMN     "systemPromptUsed" TEXT;

-- CreateTable
CREATE TABLE "AgentTemplate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconName" TEXT,
    "defaultToolSlugs" TEXT[],
    "defaultSkillIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "systemPromptBase" TEXT NOT NULL,
    "outputSchemaJson" JSONB NOT NULL,
    "docPolicy" TEXT NOT NULL,
    "docChecklistJson" JSONB NOT NULL,
    "reviewerRoleHint" TEXT,
    "selfImprovementPolicyJson" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRunReview" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "templateSlug" TEXT,
    "templateVersion" INTEGER,
    "status" TEXT NOT NULL,
    "outputJson" JSONB NOT NULL,
    "outputSummary" TEXT,
    "citationsJson" JSONB,
    "outputDigest" TEXT NOT NULL,
    "approverId" TEXT,
    "decisionAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "blockedToolCallsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRunReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRunAuditLog" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateSlug" TEXT,
    "templateVersion" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "reviewStatus" TEXT,
    "approverId" TEXT,
    "decisionAt" TIMESTAMP(3),
    "toolCallCount" INTEGER NOT NULL DEFAULT 0,
    "knowledgeSourceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "outputDigest" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRunAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditMemoryEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "op" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueDigest" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditMemoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentTemplate_slug_key" ON "AgentTemplate"("slug");

-- CreateIndex
CREATE INDEX "AgentTemplate_category_enabled_idx" ON "AgentTemplate"("category", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRunReview_runId_key" ON "AgentRunReview"("runId");

-- CreateIndex
CREATE INDEX "AgentRunReview_status_createdAt_idx" ON "AgentRunReview"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AgentRunReview_agentId_createdAt_idx" ON "AgentRunReview"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentRunReview_templateSlug_status_idx" ON "AgentRunReview"("templateSlug", "status");

-- CreateIndex
CREATE INDEX "AgentRunAuditLog_userId_startedAt_idx" ON "AgentRunAuditLog"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "AgentRunAuditLog_templateSlug_startedAt_idx" ON "AgentRunAuditLog"("templateSlug", "startedAt");

-- CreateIndex
CREATE INDEX "AgentRunAuditLog_agentId_startedAt_idx" ON "AgentRunAuditLog"("agentId", "startedAt");

-- CreateIndex
CREATE INDEX "AgentRunAuditLog_reviewStatus_decisionAt_idx" ON "AgentRunAuditLog"("reviewStatus", "decisionAt");

-- CreateIndex
CREATE INDEX "AuditMemoryEvent_agentId_createdAt_idx" ON "AuditMemoryEvent"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditMemoryEvent_userId_createdAt_idx" ON "AuditMemoryEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Agent_templateSlug_idx" ON "Agent"("templateSlug");

-- CreateIndex
CREATE INDEX "AgentRun_parentRunId_idx" ON "AgentRun"("parentRunId");

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_templateSlug_fkey" FOREIGN KEY ("templateSlug") REFERENCES "AgentTemplate"("slug") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_parentRunId_fkey" FOREIGN KEY ("parentRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRunReview" ADD CONSTRAINT "AgentRunReview_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRunReview" ADD CONSTRAINT "AgentRunReview_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRunReview" ADD CONSTRAINT "AgentRunReview_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
