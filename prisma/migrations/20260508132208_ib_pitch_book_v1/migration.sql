-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "maxTokensCostPerRunUsd" DOUBLE PRECISION NOT NULL DEFAULT 75.0;

-- CreateTable
CREATE TABLE "ScrapedDataCache" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "etag" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapedDataCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrecedentTransactionCache" (
    "id" TEXT NOT NULL,
    "acquirerName" TEXT NOT NULL,
    "targetName" TEXT NOT NULL,
    "announceDate" TIMESTAMP(3) NOT NULL,
    "closeDate" TIMESTAMP(3),
    "enterpriseValue" DECIMAL(65,30),
    "evRevenueMultiple" DECIMAL(65,30),
    "evEbitdaMultiple" DECIMAL(65,30),
    "premiumPct" DECIMAL(65,30),
    "structure" TEXT,
    "sectors" TEXT[],
    "sourceUrls" TEXT[],
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrecedentTransactionCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScrapedDataCache_expiresAt_idx" ON "ScrapedDataCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapedDataCache_source_key_key" ON "ScrapedDataCache"("source", "key");

-- CreateIndex
CREATE INDEX "PrecedentTransactionCache_announceDate_idx" ON "PrecedentTransactionCache"("announceDate");
