import { z } from "zod";
import { registerTool, toolRegistry } from "../tool-registry";
import type { ToolDef } from "../types";
import { prisma } from "@/lib/prisma";
import { checkSelfModAllowed, recordModification, snapshotAgent } from "../self-mod-guard";

const USER_TOOLS_THAT_CAN_BE_ADDED = new Set([
  "web_search", "fetch_url", "llm_reason", "save_artifact", "send_email", "post_to_chat",
]);
const PROTECTED_TOOLS_CANNOT_REMOVE = new Set(["post_to_chat"]);

// edit_persona
const editPersonaSchema = z.object({ new_text: z.string().min(0).max(4000) });
const editPersonaTool: ToolDef<typeof editPersonaSchema> = {
  slug: "edit_persona",
  description: "Modify your own systemPromptExtra (persona/style/extra rules). Max 4000 chars.",
  schema: editPersonaSchema,
  async execute(ctx, { new_text }) {
    const guard = await checkSelfModAllowed(ctx.agentId);
    if (!guard.allowed) return { ok: false, error: guard.error };
    const before = await prisma.agent.findUnique({
      where: { id: ctx.agentId },
      select: { systemPromptExtra: true },
    });
    await snapshotAgent(ctx.agentId);
    await prisma.agent.update({
      where: { id: ctx.agentId },
      data: { systemPromptExtra: new_text },
    });
    await recordModification({
      agentId: ctx.agentId,
      tickNumber: ctx.tickNumber,
      tool: "edit_persona",
      before: before?.systemPromptExtra ?? null,
      after: new_text,
    });
    return { ok: true };
  },
};
registerTool(editPersonaTool);

// add_tool
const addToolSchema = z.object({ slug: z.string() });
const addToolTool: ToolDef<typeof addToolSchema> = {
  slug: "add_tool",
  description: "Add a user tool to your own toolSlugs. Must be from the approved registry.",
  schema: addToolSchema,
  async execute(ctx, { slug }) {
    const guard = await checkSelfModAllowed(ctx.agentId);
    if (!guard.allowed) return { ok: false, error: guard.error };
    if (!USER_TOOLS_THAT_CAN_BE_ADDED.has(slug)) {
      return { ok: false, error: `tool '${slug}' is not in the approved add list` };
    }
    if (!toolRegistry.has(slug)) {
      return { ok: false, error: `tool '${slug}' is not in the registry` };
    }
    const agent = await prisma.agent.findUnique({
      where: { id: ctx.agentId },
      select: { toolSlugs: true },
    });
    if (!agent) return { ok: false, error: "agent not found" };
    if (agent.toolSlugs.includes(slug)) {
      return { ok: true, data: { noop: true, reason: "already present" } };
    }
    const next = [...agent.toolSlugs, slug];
    await snapshotAgent(ctx.agentId);
    await prisma.agent.update({
      where: { id: ctx.agentId },
      data: { toolSlugs: next },
    });
    await recordModification({
      agentId: ctx.agentId,
      tickNumber: ctx.tickNumber,
      tool: "add_tool",
      before: agent.toolSlugs,
      after: next,
    });
    return { ok: true };
  },
};
registerTool(addToolTool);

// remove_tool
const removeToolSchema = z.object({ slug: z.string() });
const removeToolTool: ToolDef<typeof removeToolSchema> = {
  slug: "remove_tool",
  description: "Remove a user tool from your own toolSlugs.",
  schema: removeToolSchema,
  async execute(ctx, { slug }) {
    const guard = await checkSelfModAllowed(ctx.agentId);
    if (!guard.allowed) return { ok: false, error: guard.error };
    if (PROTECTED_TOOLS_CANNOT_REMOVE.has(slug)) {
      return { ok: false, error: "cannot remove protected tool" };
    }
    const agent = await prisma.agent.findUnique({
      where: { id: ctx.agentId },
      select: { toolSlugs: true },
    });
    if (!agent) return { ok: false, error: "agent not found" };
    if (!agent.toolSlugs.includes(slug)) {
      return { ok: true, data: { noop: true, reason: "not present" } };
    }
    const next = agent.toolSlugs.filter((s) => s !== slug);
    await snapshotAgent(ctx.agentId);
    await prisma.agent.update({
      where: { id: ctx.agentId },
      data: { toolSlugs: next },
    });
    await recordModification({
      agentId: ctx.agentId,
      tickNumber: ctx.tickNumber,
      tool: "remove_tool",
      before: agent.toolSlugs,
      after: next,
    });
    return { ok: true };
  },
};
registerTool(removeToolTool);

// adjust_caps
const adjustCapsSchema = z.object({
  field: z.enum(["maxStepsPerCycle", "maxCycleDurationSecs", "maxTokensPerCycle"]),
  value: z.number().int().positive(),
});
const FIELD_TO_CEILING: Record<
  "maxStepsPerCycle" | "maxCycleDurationSecs" | "maxTokensPerCycle",
  "maxStepsPerCycleCeiling" | "maxCycleDurationCeiling" | "maxTokensPerCycleCeiling"
> = {
  maxStepsPerCycle: "maxStepsPerCycleCeiling",
  maxCycleDurationSecs: "maxCycleDurationCeiling",
  maxTokensPerCycle: "maxTokensPerCycleCeiling",
};
const adjustCapsTool: ToolDef<typeof adjustCapsSchema> = {
  slug: "adjust_caps",
  description:
    "Adjust one of your per-cycle caps. Each change must be at most 2x the current value and cannot exceed the hard ceiling set by the user.",
  schema: adjustCapsSchema,
  async execute(ctx, { field, value }) {
    const guard = await checkSelfModAllowed(ctx.agentId);
    if (!guard.allowed) return { ok: false, error: guard.error };
    const agent = await prisma.agent.findUnique({
      where: { id: ctx.agentId },
      include: { hardCeiling: true },
    });
    if (!agent) return { ok: false, error: "agent not found" };
    if (!agent.hardCeiling) return { ok: false, error: "no hard ceiling configured" };

    const current = agent[field] as number;
    if (value > current * 2) {
      return { ok: false, error: `can only increase by at most 2x (current ${current})` };
    }
    const ceilingField = FIELD_TO_CEILING[field];
    const ceiling = agent.hardCeiling[ceilingField] as number;
    if (value > ceiling) {
      return { ok: false, error: `exceeds hard ceiling ${ceiling}` };
    }

    await snapshotAgent(ctx.agentId);
    await prisma.agent.update({
      where: { id: ctx.agentId },
      data: { [field]: value },
    });
    await recordModification({
      agentId: ctx.agentId,
      tickNumber: ctx.tickNumber,
      tool: "adjust_caps",
      before: { field, value: current },
      after: { field, value },
    });
    return { ok: true };
  },
};
registerTool(adjustCapsTool);
