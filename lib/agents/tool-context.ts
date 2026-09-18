import type { ToolContext } from "./types";

export function makeToolContext(params: {
  userId: string;
  agentId: string;
  runId: string;
  tickNumber: number;
}): ToolContext {
  return {
    ...params,
    log: (msg, meta) => {
      if (process.env.NODE_ENV !== "production") {

        console.log(`[agent ${params.agentId} tick ${params.tickNumber}] ${msg}`, meta ?? {});
      }
    },
  };
}
