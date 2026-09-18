import { inngest } from "./client";
import { prisma } from "@/lib/prisma";
import { Prisma } from "../generated/prisma/client";
import {
  summarizeSession,
  extractFacts,
  buildTranscript,
} from "@/lib/memory/extraction";
import { embed, toPgVectorLiteral } from "@/lib/memory/embeddings";

const NEW_MESSAGE_THRESHOLD = 5;
const FACT_DUP_COSINE_THRESHOLD = 0.92;
const FACT_CAP = 50;

export const memorySessionTurnCompleted = inngest.createFunction(
  {
    id: "memory-session-turn-completed",
    debounce: { period: "10s", key: "event.data.sessionId" },
    retries: 3,
    triggers: [{ event: "memory/session.turn-completed" }],
  },
  async ({ event, step }) => {
    const { sessionId, userId } = event.data as {
      sessionId: string;
      userId: string;
    };

    const session = await step.run("load-session", () =>
      prisma.chatSession.findUnique({
        where: { id: sessionId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      }),
    );
    if (!session) return { skipped: "session not found" };

    const totalMessages = session.messages.length;
    const sinceSummary =
      totalMessages - (session.messageCountAtSummary ?? 0);
    if (sinceSummary < NEW_MESSAGE_THRESHOLD) {
      return { skipped: `only ${sinceSummary} new messages` };
    }

    const transcript = buildTranscript(
      session.messages.map((m) => ({ role: m.role, content: m.content })),
    );

    const summary = await step.run("summarize", () =>
      summarizeSession(transcript),
    );
    const summaryEmbedding = await step.run("embed-summary", () =>
      embed(summary),
    );

    await step.run("upsert-session-embedding", async () => {
      const vec = toPgVectorLiteral(summaryEmbedding);
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "SessionEmbedding" ("id", "sessionId", "userId", "summary", "embedding", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, ${sessionId}, ${userId}, ${summary}, ${vec}::vector, NOW(), NOW())
        ON CONFLICT ("sessionId") DO UPDATE SET
          "summary" = EXCLUDED."summary",
          "embedding" = EXCLUDED."embedding",
          "updatedAt" = NOW()
      `);
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: {
          summary,
          summaryUpdatedAt: new Date(),
          messageCountAtSummary: totalMessages,
        },
      });
    });

    const existingFacts = await step.run("load-facts", () =>
      prisma.userMemoryFact.findMany({ where: { userId } }),
    );

    const candidates = await step.run("extract-facts", () =>
      extractFacts(
        transcript,
        existingFacts.map((f) => f.fact),
      ),
    );

    if (candidates.length === 0)
      return { summary: "updated", newFacts: 0 };

    const candidateWithEmbeddings = await step.run(
      "embed-facts",
      async () =>
        Promise.all(
          candidates.map(async (c) => ({
            ...c,
            embedding: await embed(c.fact),
          })),
        ),
    );

    const existingEmbeddings = await step.run("embed-existing", async () =>
      Promise.all(
        existingFacts.map(async (f) => ({
          ...f,
          embedding: await embed(f.fact),
        })),
      ),
    );

    const newFacts: typeof candidateWithEmbeddings = [];
    for (const c of candidateWithEmbeddings) {
      const maxSim = existingEmbeddings.reduce((m, e) => {
        const sim = cosine(c.embedding, e.embedding);
        return sim > m ? sim : m;
      }, 0);
      if (maxSim < FACT_DUP_COSINE_THRESHOLD) newFacts.push(c);
    }

    if (newFacts.length) {
      await step.run("insert-facts", async () => {
        for (const f of newFacts) {
          await prisma.userMemoryFact.create({
            data: {
              userId,
              fact: f.fact,
              category: f.category,
              confidence: f.confidence,
            },
          });
        }
      });
      await step.run("enforce-cap", async () => {
        const all = await prisma.userMemoryFact.findMany({
          where: { userId },
        });
        if (all.length <= FACT_CAP) return;
        const now = Date.now();
        const scored = all
          .map((f) => ({
            id: f.id,
            score:
              f.confidence *
              Math.exp(
                -(now - f.lastUsedAt.getTime()) /
                  (1000 * 60 * 60 * 24 * 30),
              ),
          }))
          .sort((a, b) => a.score - b.score);
        const toDelete = scored
          .slice(0, all.length - FACT_CAP)
          .map((s) => s.id);
        await prisma.userMemoryFact.deleteMany({
          where: { id: { in: toDelete } },
        });
      });
    }

    return { summary: "updated", newFacts: newFacts.length };
  },
);

function cosine(a: number[], b: number[]): number {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
