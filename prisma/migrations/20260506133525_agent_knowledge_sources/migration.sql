-- CreateTable
CREATE TABLE "AgentKnowledgeSource" (
    "id" TEXT NOT NULL,
    "agentId" TEXT,
    "draftToken" TEXT,
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "lane" TEXT NOT NULL,
    "pageindexDocId" TEXT,
    "pageCount" INTEGER,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentKnowledgeSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentKnowledgeChunk" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "agentId" TEXT,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentKnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentKnowledgeSource_agentId_idx" ON "AgentKnowledgeSource"("agentId");

-- CreateIndex
CREATE INDEX "AgentKnowledgeSource_userId_draftToken_idx" ON "AgentKnowledgeSource"("userId", "draftToken");

-- CreateIndex
CREATE INDEX "AgentKnowledgeSource_userId_createdAt_idx" ON "AgentKnowledgeSource"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AgentKnowledgeChunk_sourceId_chunkIndex_idx" ON "AgentKnowledgeChunk"("sourceId", "chunkIndex");

-- CreateIndex
CREATE INDEX "AgentKnowledgeChunk_agentId_idx" ON "AgentKnowledgeChunk"("agentId");

-- AddForeignKey
ALTER TABLE "AgentKnowledgeSource" ADD CONSTRAINT "AgentKnowledgeSource_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentKnowledgeSource" ADD CONSTRAINT "AgentKnowledgeSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentKnowledgeChunk" ADD CONSTRAINT "AgentKnowledgeChunk_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AgentKnowledgeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
