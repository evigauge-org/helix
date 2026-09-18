CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "ChatSession" ADD COLUMN     "messageCountAtSummary" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "summaryUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SessionEmbedding" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMemoryFact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fact" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMemoryFact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionEmbedding_sessionId_key" ON "SessionEmbedding"("sessionId");

-- CreateIndex
CREATE INDEX "SessionEmbedding_userId_idx" ON "SessionEmbedding"("userId");

-- CreateIndex
CREATE INDEX "UserMemoryFact_userId_idx" ON "UserMemoryFact"("userId");

-- AddForeignKey
ALTER TABLE "SessionEmbedding" ADD CONSTRAINT "SessionEmbedding_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEmbedding" ADD CONSTRAINT "SessionEmbedding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMemoryFact" ADD CONSTRAINT "UserMemoryFact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "SessionEmbedding_embedding_hnsw_idx" ON "SessionEmbedding" USING hnsw (embedding vector_cosine_ops);
