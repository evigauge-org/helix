CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "ResearchResponseEmbedding" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "chatSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchResponseEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResearchResponseEmbedding_messageId_key" ON "ResearchResponseEmbedding"("messageId");

-- CreateIndex
CREATE INDEX "ResearchResponseEmbedding_chatSessionId_idx" ON "ResearchResponseEmbedding"("chatSessionId");

-- CreateIndex
CREATE INDEX "ResearchResponseEmbedding_userId_idx" ON "ResearchResponseEmbedding"("userId");

-- AddForeignKey
ALTER TABLE "ResearchResponseEmbedding" ADD CONSTRAINT "ResearchResponseEmbedding_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchResponseEmbedding" ADD CONSTRAINT "ResearchResponseEmbedding_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchResponseEmbedding" ADD CONSTRAINT "ResearchResponseEmbedding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex (HNSW for cosine similarity on research embeddings)
CREATE INDEX "ResearchResponseEmbedding_embedding_hnsw_idx" ON "ResearchResponseEmbedding" USING hnsw (embedding vector_cosine_ops);
