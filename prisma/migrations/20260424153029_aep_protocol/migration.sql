/*
  Warnings:

  - A unique constraint covering the columns `[aepId]` on the table `Agent` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[aepId]` on the table `AgentArtifact` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[aepId]` on the table `AgentMessage` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[aepId]` on the table `AgentRun` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AepLifecycleState" AS ENUM ('active', 'sleeping', 'complete', 'cancelled', 'error', 'archived');

-- CreateEnum
CREATE TYPE "AepRunState" AS ENUM ('running', 'sleeping', 'complete', 'cancelled', 'error');

-- CreateEnum
CREATE TYPE "AepPromptPolicy" AS ENUM ('auto', 'approval_required', 'locked');

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "aepId" TEXT,
ADD COLUMN     "aepMetadata" JSONB,
ADD COLUMN     "budgetsJson" JSONB,
ADD COLUMN     "ceilingsJson" JSONB,
ADD COLUMN     "constitutionImmutable" TEXT,
ADD COLUMN     "constitutionMutable" TEXT,
ADD COLUMN     "constitutionPolicy" "AepPromptPolicy" NOT NULL DEFAULT 'auto',
ADD COLUMN     "lifecycleState" "AepLifecycleState" NOT NULL DEFAULT 'active',
ADD COLUMN     "subjectIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "toolset" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "AgentArtifact" ADD COLUMN     "aepId" TEXT,
ADD COLUMN     "aepMetadata" JSONB,
ADD COLUMN     "bytes" BYTEA,
ADD COLUMN     "sha256" TEXT,
ADD COLUMN     "sizeBytes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subjectId" TEXT;

-- AlterTable
ALTER TABLE "AgentMessage" ADD COLUMN     "aepBody" JSONB,
ADD COLUMN     "aepId" TEXT,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "treeRootId" TEXT;

-- AlterTable
ALTER TABLE "AgentRun" ADD COLUMN     "aepId" TEXT,
ADD COLUMN     "aepMetadata" JSONB,
ADD COLUMN     "aepResult" JSONB,
ADD COLUMN     "aepState" "AepRunState" NOT NULL DEFAULT 'running',
ADD COLUMN     "cycleCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subjectIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "AepSession" (
    "id" TEXT NOT NULL,
    "aepId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "protocolVersion" TEXT NOT NULL,
    "negotiatedCapabilities" JSONB NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AepSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AepEvent" (
    "id" TEXT NOT NULL,
    "aepId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "emittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sequenceNum" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "AepEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AepPromptHistoryEntry" (
    "id" TEXT NOT NULL,
    "aepId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "diff" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "approvedBy" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pendingAepId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'applied',

    CONSTRAINT "AepPromptHistoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AepMemoryRecord" (
    "id" TEXT NOT NULL,
    "aepId" TEXT NOT NULL,
    "treeRootId" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "createdByAgentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subjectId" TEXT,
    "ttlSeconds" INTEGER,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "AepMemoryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AepPendingPromptChange" (
    "id" TEXT NOT NULL,
    "aepId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "proposedDiff" TEXT NOT NULL,
    "proposedContent" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "resolvedBy" TEXT,
    "comment" TEXT,

    CONSTRAINT "AepPendingPromptChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AepSession_aepId_key" ON "AepSession"("aepId");

-- CreateIndex
CREATE INDEX "AepSession_userId_createdAt_idx" ON "AepSession"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AepEvent_aepId_key" ON "AepEvent"("aepId");

-- CreateIndex
CREATE INDEX "AepEvent_runId_emittedAt_idx" ON "AepEvent"("runId", "emittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AepEvent_runId_sequenceNum_key" ON "AepEvent"("runId", "sequenceNum");

-- CreateIndex
CREATE UNIQUE INDEX "AepPromptHistoryEntry_aepId_key" ON "AepPromptHistoryEntry"("aepId");

-- CreateIndex
CREATE UNIQUE INDEX "AepPromptHistoryEntry_pendingAepId_key" ON "AepPromptHistoryEntry"("pendingAepId");

-- CreateIndex
CREATE INDEX "AepPromptHistoryEntry_agentId_appliedAt_idx" ON "AepPromptHistoryEntry"("agentId", "appliedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AepMemoryRecord_aepId_key" ON "AepMemoryRecord"("aepId");

-- CreateIndex
CREATE INDEX "AepMemoryRecord_treeRootId_namespace_createdAt_idx" ON "AepMemoryRecord"("treeRootId", "namespace", "createdAt");

-- CreateIndex
CREATE INDEX "AepMemoryRecord_subjectId_idx" ON "AepMemoryRecord"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "AepMemoryRecord_treeRootId_namespace_key_key" ON "AepMemoryRecord"("treeRootId", "namespace", "key");

-- CreateIndex
CREATE UNIQUE INDEX "AepPendingPromptChange_aepId_key" ON "AepPendingPromptChange"("aepId");

-- CreateIndex
CREATE INDEX "AepPendingPromptChange_agentId_createdAt_idx" ON "AepPendingPromptChange"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "AepPendingPromptChange_agentId_resolvedAt_idx" ON "AepPendingPromptChange"("agentId", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_aepId_key" ON "Agent"("aepId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentArtifact_aepId_key" ON "AgentArtifact"("aepId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentMessage_aepId_key" ON "AgentMessage"("aepId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRun_aepId_key" ON "AgentRun"("aepId");

-- AddForeignKey
ALTER TABLE "AepSession" ADD CONSTRAINT "AepSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AepEvent" ADD CONSTRAINT "AepEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AepPromptHistoryEntry" ADD CONSTRAINT "AepPromptHistoryEntry_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AepPendingPromptChange" ADD CONSTRAINT "AepPendingPromptChange_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
