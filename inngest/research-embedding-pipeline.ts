import { inngest } from "./client";
import { prisma } from "@/lib/prisma";
import { Prisma } from "../generated/prisma/client";
import { embed, toPgVectorLiteral } from "@/lib/memory/embeddings";
import { RESEARCH_SUMMARY_PROMPT } from "@/lib/memory/research-prompts";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemma-4-26b-a4b-it";
const ARTIFACT_KEYS = [
  "parsed_files",
  "attached_files",
  "financial_excel",
  "reproducibility",
  "presentation",
  "carousel",
  "gamma",
];

async function summarizeResponse(
  query: string,
  answer: string,
  artifactKeys: string[],
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const fallback = `${query}: ${answer.slice(0, 280)}`;
  if (!apiKey) return fallback;
  const prompt = RESEARCH_SUMMARY_PROMPT({ query, answer, artifactKeys });
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 400,
        temperature: 0.2,
      }),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === "string" && content.trim().length > 0
      ? content.trim()
      : fallback;
  } catch {
    return fallback;
  }
}

export const researchResponseEmbedding = inngest.createFunction(
  {
    id: "research-response-embedding",
    retries: 3,
    triggers: [{ event: "memory/research.completed" }],
  },
  async ({ event, step }) => {
    const { messageId, chatSessionId, userId } = event.data as {
      messageId: string;
      chatSessionId: string;
      userId: string;
    };

    const existing = await step.run("load-existing", () =>
      prisma.researchResponseEmbedding.findUnique({ where: { messageId } }),
    );
    if (existing) return { skipped: "already embedded" };

    const message = await step.run("load-message", () =>
      prisma.chatMessage.findUnique({
        where: { id: messageId },
        select: { content: true, metadata: true },
      }),
    );
    if (!message || !message.metadata || typeof message.metadata !== "object")
      return { skipped: "no metadata" };
    const md = message.metadata as Record<string, unknown>;
    const query = typeof md.query === "string" ? md.query : "";
    const answer =
      typeof md.answer === "string" ? md.answer : message.content;
    const artifactKeys = ARTIFACT_KEYS.filter((k) => {
      const v = md[k];
      if (v == null) return false;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === "object") return Object.keys(v as object).length > 0;
      return true;
    });

    const summary = await step.run("summarize", () =>
      summarizeResponse(query, answer, artifactKeys),
    );
    const vec = await step.run("embed", () => embed(summary));

    await step.run("upsert", async () => {
      const lit = toPgVectorLiteral(vec);
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "ResearchResponseEmbedding" ("id", "messageId", "chatSessionId", "userId", "summary", "embedding", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, ${messageId}, ${chatSessionId}, ${userId}, ${summary}, ${lit}::vector, NOW(), NOW())
        ON CONFLICT ("messageId") DO UPDATE SET
          "summary" = EXCLUDED."summary",
          "embedding" = EXCLUDED."embedding",
          "updatedAt" = NOW()
      `);
    });

    return { embedded: messageId };
  },
);
