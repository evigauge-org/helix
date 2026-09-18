import { prisma } from "@/lib/prisma";
import { Prisma } from "../../generated/prisma/client";
import { toPgVectorLiteral } from "./embeddings";

export type UserFact = {
  id: string;
  fact: string;
  category: string;
  confidence: number;
};

export type SessionHit = {
  sessionId: string;
  summary: string;
  distance: number;
};

export async function getUserFacts(userId: string): Promise<UserFact[]> {
  const rows = await prisma.userMemoryFact.findMany({
    where: { userId },
    orderBy: [{ confidence: "desc" }, { lastUsedAt: "desc" }],
    take: 50,
  });
  return rows.map((r) => ({
    id: r.id,
    fact: r.fact,
    category: r.category,
    confidence: r.confidence,
  }));
}

export async function getTopKSessions(
  userId: string,
  queryEmbedding: number[],
  k = 3,
  excludeSessionId?: string,
): Promise<SessionHit[]> {
  const vecLiteral = toPgVectorLiteral(queryEmbedding);
  const excludeClause = excludeSessionId
    ? Prisma.sql`AND "sessionId" <> ${excludeSessionId}`
    : Prisma.empty;
  const rows = await prisma.$queryRaw<
    Array<{ sessionId: string; summary: string; distance: number }>
  >(Prisma.sql`
    SELECT "sessionId", "summary",
           embedding <=> ${vecLiteral}::vector AS distance
    FROM "SessionEmbedding"
    WHERE "userId" = ${userId}
    ${excludeClause}
    ORDER BY distance ASC
    LIMIT ${k}
  `);
  return rows;
}
