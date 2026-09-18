import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { embed, toPgVectorLiteral } from "@/lib/memory/embeddings";
import { getPageIndexClient } from "@/lib/agents/knowledge/pageindex-client";
import type { ToolDef, ToolContext, ToolResult } from "../types";

const schema = z.object({
  query: z.string().min(1).max(500),
  top_k: z.number().int().min(1).max(5).default(3),
  scope: z.enum(["pdfs", "others", "all"]).default("all"),
});

const PAGEINDEX_PSEUDO_SCORE = 0.85;
const MAX_PAGEINDEX_DOCS_PER_CALL = 10;

interface Hit {
  filename: string;
  excerpt: string;
  sourceId: string;
  lane: "pageindex" | "pgvector";
  pageNumber?: number;
  chunkIndex?: number;
  score: number;
}

export const searchKnowledgeTool: ToolDef<typeof schema> = {
  slug: "search_knowledge",
  description:
    "Search the user's uploaded knowledge corpus (PDFs and text files attached to this agent). Returns top-k excerpts with source filenames as citations.",
  schema,
  async execute(ctx: ToolContext, args: z.infer<typeof schema>): Promise<ToolResult> {
    if (!args.query.trim()) {
      return { ok: true, data: { hits: [], hint: "Empty query" } };
    }

    const sources = await prisma.agentKnowledgeSource.findMany({
      where: { agentId: ctx.agentId, status: "ready" },
      select: { id: true, filename: true, lane: true, pageindexDocId: true },
    });

    if (sources.length === 0) {
      return { ok: true, data: { hits: [], hint: "No knowledge sources attached." } };
    }

    const wantPdfs = args.scope === "all" || args.scope === "pdfs";
    const wantOthers = args.scope === "all" || args.scope === "others";

    const pageindexSources = wantPdfs
      ? sources.filter((s) => s.lane === "pageindex" && s.pageindexDocId).slice(0, MAX_PAGEINDEX_DOCS_PER_CALL)
      : [];
    const pgvectorSourceIds = wantOthers
      ? sources.filter((s) => s.lane === "pgvector").map((s) => s.id)
      : [];

    const laneAPromise = (async (): Promise<Hit[]> => {
      if (pageindexSources.length === 0) return [];
      const client = getPageIndexClient();
      const results = await Promise.allSettled(
        pageindexSources.map(async (s): Promise<Hit | null> => {
          const resp = await client.api.chatCompletions({
            messages: [{ role: "user", content: args.query }],
            doc_id: s.pageindexDocId!,
          });
          const choice = "choices" in resp ? resp.choices[0] : null;
          const content = choice?.message?.content ?? "";
          if (!content) return null;
          return {
            filename: s.filename,
            excerpt: content,
            sourceId: s.id,
            lane: "pageindex",
            score: PAGEINDEX_PSEUDO_SCORE,
          };
        }),
      );
      return results
        .filter((r): r is PromiseFulfilledResult<Hit | null> => r.status === "fulfilled")
        .map((r) => r.value)
        .filter((v): v is Hit => v !== null);
    })();

    const laneBPromise = (async (): Promise<Hit[]> => {
      if (pgvectorSourceIds.length === 0) return [];
      const queryVec = await embed(args.query);
      const lit = toPgVectorLiteral(queryVec);
      const rows = await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          content: string;
          chunkIndex: number;
          sourceId: string;
          filename: string;
          score: number;
        }>
      >(
        `SELECT c.id, c.content, c."chunkIndex" AS "chunkIndex", c."sourceId" AS "sourceId",
                s.filename,
                1 - (c.embedding <=> '${lit}'::vector) AS score
         FROM "AgentKnowledgeChunk" c
         JOIN "AgentKnowledgeSource" s ON s.id = c."sourceId"
         WHERE c."agentId" = $1 AND s.status = 'ready'
         ORDER BY c.embedding <=> '${lit}'::vector
         LIMIT $2`,
        ctx.agentId,
        args.top_k,
      );
      return rows.map((r) => ({
        filename: r.filename,
        excerpt: r.content,
        sourceId: r.sourceId,
        lane: "pgvector" as const,
        chunkIndex: r.chunkIndex,
        score: Number(r.score),
      }));
    })();

    const [laneA, laneB] = await Promise.all([laneAPromise, laneBPromise]);
    const merged = [...laneA, ...laneB]
      .sort((a, b) => b.score - a.score)
      .slice(0, args.top_k);

    ctx.log(`search_knowledge query="${args.query}" hits=${merged.length}`);

    return { ok: true, data: { hits: merged } };
  },
};
