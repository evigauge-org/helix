-- CreateTable
CREATE TABLE "UserDataGovInKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "keyMask" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "UserDataGovInKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserDataGovInKey_userId_key" ON "UserDataGovInKey"("userId");

-- AddForeignKey
ALTER TABLE "UserDataGovInKey" ADD CONSTRAINT "UserDataGovInKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
