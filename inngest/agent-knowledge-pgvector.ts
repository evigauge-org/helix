import { inngest } from "./client";
import { prisma } from "@/lib/prisma";
import { embed, toPgVectorLiteral } from "@/lib/memory/embeddings";
import { laneFromFilename, parseToText, type ParseLane } from "@/lib/agents/knowledge/parse";
import { chunkText } from "@/lib/agents/knowledge/chunk";
import { createId } from "@paralleldrive/cuid2";

export const agentKnowledgePgvector = inngest.createFunction(
  {
    id: "agent-knowledge-pgvector",
    retries: 2,
    triggers: [{ event: "agent-knowledge/process.requested" }],
  },
  async ({ event, step }) => {
    const { sourceId, lane, fileBase64, filename } = event.data as {
      sourceId: string;
      lane: string;
      fileBase64: string;
      filename: string;
    };
    if (lane !== "pgvector") return { skipped: "wrong lane" };

    await step.run("mark-processing", () =>
      prisma.agentKnowledgeSource.update({
        where: { id: sourceId },
        data: { status: "processing" },
      }),
    );

    try {
      const text = await step.run("parse", async () => {
        const parseLane: ParseLane | null = laneFromFilename(filename);
        if (!parseLane) throw new Error(`unrecognized format: ${filename}`);
        const buffer = Buffer.from(fileBase64, "base64");
        return parseToText(buffer, parseLane);
      });

      const chunks = await step.run("chunk", async () => chunkText(text));
      if (chunks.length === 0) throw new Error("no chunks produced (empty file?)");

      const source = await step.run("load-source", () =>
        prisma.agentKnowledgeSource.findUnique({
          where: { id: sourceId },
          select: { agentId: true },
        }),
      );
      const agentId = source?.agentId ?? null;

      for (const chunk of chunks) {
        await step.run(`embed-insert-${chunk.index}`, async () => {
          const vec = await embed(chunk.content);
          const lit = toPgVectorLiteral(vec);
          const id = createId();
          await prisma.$executeRawUnsafe(
            `INSERT INTO "AgentKnowledgeChunk"
              (id, "sourceId", "agentId", "chunkIndex", content, "tokenCount", embedding, "createdAt")
             VALUES ($1, $2, $3, $4, $5, $6, '${lit}'::vector, NOW())`,
            id,
            sourceId,
            agentId,
            chunk.index,
            chunk.content,
            chunk.tokenCount,
          );
        });
      }

      await step.run("finalize-ready", () =>
        prisma.agentKnowledgeSource.update({
          where: { id: sourceId },
          data: {
            status: "ready",
            chunkCount: chunks.length,
            errorMessage: null,
          },
        }),
      );
      return { sourceId, finalStatus: "ready", chunkCount: chunks.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await step.run("finalize-failed", () =>
        prisma.agentKnowledgeSource.update({
          where: { id: sourceId },
          data: { status: "failed", errorMessage: message },
        }),
      );
      return { sourceId, finalStatus: "failed", errorMessage: message };
    }
  },
);
