-- CreateTable
CREATE TABLE "StoreStageSection" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "versions" JSONB NOT NULL,
    "activeVersionId" TEXT NOT NULL,
    "approvedVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreStageSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreStageSection_stageId_idx" ON "StoreStageSection"("stageId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreStageSection_stageId_sectionId_key" ON "StoreStageSection"("stageId", "sectionId");

-- AddForeignKey
ALTER TABLE "StoreStageSection" ADD CONSTRAINT "StoreStageSection_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "store_stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
