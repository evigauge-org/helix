-- CreateEnum
CREATE TYPE "LlmProviderKind" AS ENUM ('openai_compat', 'anthropic', 'gemini');

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "runnerProviderId" TEXT;

-- CreateTable
CREATE TABLE "LlmProvider" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "LlmProviderKind" NOT NULL,
    "baseUrl" TEXT,
    "apiKeyCipher" TEXT NOT NULL,
    "apiKeyIv" TEXT NOT NULL,
    "apiKeyAuthTag" TEXT NOT NULL,
    "apiKeyHint" TEXT NOT NULL,
    "defaultModel" TEXT,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LlmProvider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LlmProvider_userId_idx" ON "LlmProvider"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LlmProvider_userId_name_key" ON "LlmProvider"("userId", "name");

-- CreateIndex
CREATE INDEX "Agent_runnerProviderId_idx" ON "Agent"("runnerProviderId");

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_runnerProviderId_fkey" FOREIGN KEY ("runnerProviderId") REFERENCES "LlmProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlmProvider" ADD CONSTRAINT "LlmProvider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
