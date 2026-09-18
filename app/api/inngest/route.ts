import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { storePipeline } from "@/inngest/store-pipeline";
import { memorySessionTurnCompleted } from "@/inngest/memory-pipeline";
import { researchResponseEmbedding } from "@/inngest/research-embedding-pipeline";
import { agentRunStart, agentRunTick } from "@/inngest/agent-runner";
import { agentKnowledgePageindex } from "@/inngest/agent-knowledge-pageindex";
import { agentKnowledgePgvector } from "@/inngest/agent-knowledge-pgvector";
import { agentKnowledgeDraftCleanup } from "@/inngest/agent-knowledge-draft-cleanup";
import { sandboxReaper } from "@/inngest/sandbox-reaper";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    storePipeline,
    memorySessionTurnCompleted,
    researchResponseEmbedding,
    agentRunStart,
    agentRunTick,
    agentKnowledgePageindex,
    agentKnowledgePgvector,
    agentKnowledgeDraftCleanup,
    sandboxReaper,
  ],
});
