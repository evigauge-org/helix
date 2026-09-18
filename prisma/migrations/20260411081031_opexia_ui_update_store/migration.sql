-- CreateTable
CREATE TABLE "store_project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'wizard',
    "brief" JSONB,
    "currentStage" INTEGER NOT NULL DEFAULT 0,
    "shopifyStoreUrl" TEXT,
    "shopifyAccessToken" TEXT,
    "inngestRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_stage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stage" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "input" JSONB,
    "output" JSONB,
    "userFeedback" TEXT,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "store_stage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "store_project_userId_idx" ON "store_project"("userId");

-- CreateIndex
CREATE INDEX "store_stage_projectId_idx" ON "store_stage"("projectId");

-- AddForeignKey
ALTER TABLE "store_project" ADD CONSTRAINT "store_project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_stage" ADD CONSTRAINT "store_stage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "store_project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
