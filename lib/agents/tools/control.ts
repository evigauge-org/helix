import { z } from "zod";
import { registerTool } from "../tool-registry";
import type { ToolDef } from "../types";

export class CycleEndSignal extends Error {
  constructor(
    public readonly kind: "sleep" | "complete" | "continue_now",
    public readonly payload: Record<string, unknown>,
  ) {
    super(`cycle_end:${kind}`);
    this.name = "CycleEndSignal";
  }
}

const sleepSchema = z.object({
  duration_seconds: z.number().int().min(60).max(7 * 24 * 60 * 60),
  reason: z.string().min(1).max(500),
});
const sleepTool: ToolDef<typeof sleepSchema> = {
  slug: "sleep",
  description: "End this cycle and sleep for duration_seconds (min 60, max 7 days). The agent will automatically wake up and run another cycle.",
  schema: sleepSchema,
  async execute(_ctx, args) {
    throw new CycleEndSignal("sleep", args);
  },
};
registerTool(sleepTool);

const completeSchema = z.object({
  final_message: z.string().min(1).max(20000),
  artifact_ids: z.array(z.string()).optional(),
});
const completeTool: ToolDef<typeof completeSchema> = {
  slug: "complete",
  description: "Terminate this agent run successfully. Provide a final_message that will be posted to the originating chat if available, and optionally the artifact_ids you want to highlight.",
  schema: completeSchema,
  async execute(_ctx, args) {
    throw new CycleEndSignal("complete", args);
  },
};
registerTool(completeTool);

const continueSchema = z.object({});
const continueTool: ToolDef<typeof continueSchema> = {
  slug: "continue_now",
  description: "End this cycle and immediately run another cycle without sleeping. Use sparingly; per-cycle caps still apply.",
  schema: continueSchema,
  async execute(_ctx) {
    throw new CycleEndSignal("continue_now", {});
  },
};
registerTool(continueTool);
