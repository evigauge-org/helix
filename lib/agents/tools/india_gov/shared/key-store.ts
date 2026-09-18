// lib/agents/tools/india_gov/shared/key-store.ts
// Per-user data.gov.in API key store. Plaintext is decrypted on read,
// best-effort lastUsedAt update fires-and-forgets, and 401 from the
// upstream data.gov.in API is recorded by flagging status="needs_rotation".

import { prisma } from "@/lib/prisma";
import { decryptDataGovInKey } from "@/lib/crypto/data-gov-in-keys";

export async function getUserDataGovInKey(userId: string): Promise<string | null> {
  const row = await prisma.userDataGovInKey.findUnique({ where: { userId } });
  if (!row) return null;
  try {
    const plaintext = decryptDataGovInKey({
      iv: row.iv,
      authTag: row.authTag,
      ciphertext: row.ciphertext,
    });
    void prisma.userDataGovInKey
      .update({ where: { userId }, data: { lastUsedAt: new Date() } })
      .catch(() => {
        // best-effort; never fail a tool call because of telemetry
      });
    return plaintext;
  } catch {
    // master-secret rotated, row corrupt, or auth-tag mismatch — treat as missing
    return null;
  }
}

export async function flagKeyNeedsRotation(userId: string): Promise<void> {
  await prisma.userDataGovInKey
    .update({ where: { userId }, data: { status: "needs_rotation" } })
    .catch(() => {
      // best-effort; if the row vanished between the failing call and now, fine
    });
}
