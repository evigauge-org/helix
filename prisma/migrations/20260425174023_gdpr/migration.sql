-- AlterTable
ALTER TABLE "AgentMessage" ADD COLUMN     "subjectId" TEXT;

-- CreateTable
CREATE TABLE "subject" (
    "id" TEXT NOT NULL,
    "aepId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metadata" JSONB,
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject_erasure_log" (
    "id" TEXT NOT NULL,
    "subjectAepId" TEXT NOT NULL,
    "subjectRowId" TEXT,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subject_erasure_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subject_aepId_key" ON "subject"("aepId");

-- CreateIndex
CREATE INDEX "subject_userId_idx" ON "subject"("userId");

-- CreateIndex
CREATE INDEX "subject_erasure_log_subjectAepId_performedAt_idx" ON "subject_erasure_log"("subjectAepId", "performedAt");

-- CreateIndex
CREATE INDEX "subject_erasure_log_userId_performedAt_idx" ON "subject_erasure_log"("userId", "performedAt");

-- CreateIndex
CREATE INDEX "AgentMessage_subjectId_idx" ON "AgentMessage"("subjectId");

-- AddForeignKey
ALTER TABLE "subject" ADD CONSTRAINT "subject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_erasure_log" ADD CONSTRAINT "subject_erasure_log_subjectRowId_fkey" FOREIGN KEY ("subjectRowId") REFERENCES "subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_erasure_log" ADD CONSTRAINT "subject_erasure_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
