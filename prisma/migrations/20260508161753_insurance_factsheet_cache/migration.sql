-- CreateTable
CREATE TABLE "InsuranceFactsheetCache" (
    "id" TEXT NOT NULL,
    "insurerSlug" TEXT NOT NULL,
    "monthLabel" TEXT NOT NULL,
    "monthYyyymm" TEXT NOT NULL,
    "pdfBytes" BYTEA NOT NULL,
    "pdfUrl" TEXT NOT NULL,
    "sizeKb" INTEGER NOT NULL,
    "pageCount" INTEGER,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsuranceFactsheetCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InsuranceFactsheetCache_fetchedAt_idx" ON "InsuranceFactsheetCache"("fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceFactsheetCache_insurerSlug_monthYyyymm_key" ON "InsuranceFactsheetCache"("insurerSlug", "monthYyyymm");
