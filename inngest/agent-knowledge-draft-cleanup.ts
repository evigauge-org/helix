import { inngest } from "./client";
import { prisma } from "@/lib/prisma";
import { getPageIndexClient } from "@/lib/agents/knowledge/pageindex-client";

export const agentKnowledgeDraftCleanup = inngest.createFunction(
  {
    id: "agent-knowledge-draft-cleanup",
    retries: 1,
    triggers: [{ cron: "0 4 * * *" }],
  },
  async ({ step }) => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const stale = await step.run("load-stale", () =>
      prisma.agentKnowledgeSource.findMany({
        where: {
          agentId: null,
          createdAt: { lt: cutoff },
        },
        select: { id: true, lane: true, pageindexDocId: true },
      }),
    );

    let pageindexDeleted = 0;
    let pageindexFailed = 0;
    for (const s of stale) {
      if (s.lane === "pageindex" && s.pageindexDocId) {
        try {
          await step.run(`del-pageindex-${s.id}`, async () => {
            const client = getPageIndexClient();
            await client.api.deleteDocument(s.pageindexDocId!);
          });
          pageindexDeleted += 1;
        } catch {
          pageindexFailed += 1;
        }
      }
    }

    const deleted = await step.run("delete-rows", () =>
      prisma.agentKnowledgeSource.deleteMany({
        where: { id: { in: stale.map((s) => s.id) } },
      }),
    );

    return {
      cutoff: cutoff.toISOString(),
      rowsDeleted: deleted.count,
      pageindexDeleted,
      pageindexFailed,
    };
  },
);
