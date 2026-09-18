import { prisma } from "@/lib/prisma";
import { Prisma } from "../../generated/prisma/client";
import { toPgVectorLiteral } from "@/lib/memory/embeddings";

export type ResearchHit = {
  messageId: string;
  summary: string;
  distance: number;
};

export async function getTopKResearch(
  chatSessionId: string,
  queryEmbedding: number[],
  k = 3,
): Promise<ResearchHit[]> {
  const vec = toPgVectorLiteral(queryEmbedding);
  const rows = await prisma.$queryRaw<
    Array<{ messageId: string; summary: string; distance: number }>
  >(Prisma.sql`
    SELECT "messageId", "summary",
           embedding <=> ${vec}::vector AS distance
    FROM "ResearchResponseEmbedding"
    WHERE "chatSessionId" = ${chatSessionId}
    ORDER BY distance ASC
    LIMIT ${k}
  `);
  return rows;
}

export async function countResearchInSession(chatSessionId: string): Promise<number> {
  return prisma.researchResponseEmbedding.count({ where: { chatSessionId } });
}
