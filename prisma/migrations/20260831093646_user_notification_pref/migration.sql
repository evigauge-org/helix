-- CreateTable
CREATE TABLE "UserNotificationPref" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentRunCompleted" BOOLEAN NOT NULL DEFAULT true,
    "agentRunFailed" BOOLEAN NOT NULL DEFAULT true,
    "reviewPending" BOOLEAN NOT NULL DEFAULT true,
    "agentModified" BOOLEAN NOT NULL DEFAULT false,
    "lastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNotificationPref_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserNotificationPref_userId_key" ON "UserNotificationPref"("userId");

-- AddForeignKey
ALTER TABLE "UserNotificationPref" ADD CONSTRAINT "UserNotificationPref_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
