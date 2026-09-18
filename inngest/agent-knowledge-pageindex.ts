import { inngest } from "./client";
import { prisma } from "@/lib/prisma";
import { getPageIndexClient } from "@/lib/agents/knowledge/pageindex-client";

const POLL_INTERVAL_SECS = 5;
const POLL_MAX_ATTEMPTS = 60;

export const agentKnowledgePageindex = inngest.createFunction(
  {
    id: "agent-knowledge-pageindex",
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
    if (lane !== "pageindex") return { skipped: "wrong lane" };

    await step.run("mark-processing", () =>
      prisma.agentKnowledgeSource.update({
        where: { id: sourceId },
        data: { status: "processing" },
      }),
    );

    const docId = await step.run("submit-to-pageindex", async () => {
      const client = getPageIndexClient();
      const buffer = Buffer.from(fileBase64, "base64");
      const result = await client.api.submitDocument(buffer, filename);
      await prisma.agentKnowledgeSource.update({
        where: { id: sourceId },
        data: { pageindexDocId: result.doc_id },
      });
      return result.doc_id;
    });

    let finalStatus: "ready" | "failed" = "failed";
    let errorMessage: string | null = "polling timeout";
    let pageCount: number | null = null;

    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      const polled = await step.run(`poll-${attempt}`, async () => {
        const client = getPageIndexClient();
        const tree = await client.api.getTree(docId);
        return { status: tree.status };
      });

      if (polled.status === "completed") {
        const meta = await step.run(`meta-${attempt}`, async () => {
          const client = getPageIndexClient();
          return client.api.getDocument(docId);
        });
        finalStatus = "ready";
        errorMessage = null;
        pageCount = meta.pageNum ?? null;
        break;
      }
      if (polled.status === "failed") {
        finalStatus = "failed";
        errorMessage = "PageIndex reported processing failure";
        break;
      }
      await step.sleep(`wait-${attempt}`, `${POLL_INTERVAL_SECS}s`);
    }

    await step.run("finalize", () =>
      prisma.agentKnowledgeSource.update({
        where: { id: sourceId },
        data: {
          status: finalStatus,
          errorMessage,
          pageCount,
        },
      }),
    );

    return { sourceId, finalStatus };
  },
);
