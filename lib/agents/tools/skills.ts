import { z } from "zod";
import { Prisma } from "../../../generated/prisma/client";
import { registerTool } from "../tool-registry";
import type { ToolDef } from "../types";
import { prisma } from "@/lib/prisma";
import { checkSelfModAllowed, recordModification } from "../self-mod-guard";

const MAX_SKILLS_PER_AGENT = 50;

// create_skill
const createSkillSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  body: z.string().min(1).max(4000),
});
const createSkillTool: ToolDef<typeof createSkillSchema> = {
  slug: "create_skill",
  description:
    "Save a named reusable skill (prompt/procedure). Max 50 per agent; oldest-by-lastUsedAt pruned on overflow.",
  schema: createSkillSchema,
  async execute(ctx, { name, description, body }) {
    const guard = await checkSelfModAllowed(ctx.agentId);
    if (!guard.allowed) return { ok: false, error: guard.error };

    const count = await prisma.agentSkill.count({ where: { agentId: ctx.agentId } });
    if (count >= MAX_SKILLS_PER_AGENT) {
      const oldest = await prisma.agentSkill.findFirst({
        where: { agentId: ctx.agentId },
        orderBy: [{ lastUsedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
      });
      if (oldest) {
        await prisma.agentSkill.delete({ where: { id: oldest.id } });
      }
    }

    try {
      const created = await prisma.agentSkill.create({
        data: { agentId: ctx.agentId, name, description, body },
      });
      await recordModification({
        agentId: ctx.agentId,
        tickNumber: ctx.tickNumber,
        tool: "create_skill",
        before: null,
        after: { skillId: created.id, name: created.name },
      });
      return { ok: true, data: { skillId: created.id } };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        (err as { code?: string }).code === "P2002"
      ) {
        return { ok: false, error: "skill name already exists" };
      }
      throw err;
    }
  },
};
registerTool(createSkillTool);

// edit_skill
const editSkillSchema = z.object({
  name: z.string(),
  description: z.string().max(500).optional(),
  body: z.string().max(4000).optional(),
});
const editSkillTool: ToolDef<typeof editSkillSchema> = {
  slug: "edit_skill",
  description: "Update an existing skill by name.",
  schema: editSkillSchema,
  async execute(ctx, { name, description, body }) {
    const guard = await checkSelfModAllowed(ctx.agentId);
    if (!guard.allowed) return { ok: false, error: guard.error };

    const existing = await prisma.agentSkill.findUnique({
      where: { agentId_name: { agentId: ctx.agentId, name } },
    });
    if (!existing) return { ok: false, error: `skill '${name}' not found` };

    const nextDescription = description ?? existing.description;
    const nextBody = body ?? existing.body;

    const updated = await prisma.agentSkill.update({
      where: { agentId_name: { agentId: ctx.agentId, name } },
      data: { description: nextDescription, body: nextBody },
    });

    await recordModification({
      agentId: ctx.agentId,
      tickNumber: ctx.tickNumber,
      tool: "edit_skill",
      before: {
        skillId: existing.id,
        name: existing.name,
        description: existing.description,
        body: existing.body,
      },
      after: {
        skillId: updated.id,
        name: updated.name,
        description: updated.description,
        body: updated.body,
      },
    });
    return { ok: true };
  },
};
registerTool(editSkillTool);

// delete_skill
const deleteSkillSchema = z.object({ name: z.string() });
const deleteSkillTool: ToolDef<typeof deleteSkillSchema> = {
  slug: "delete_skill",
  description: "Delete a skill by name.",
  schema: deleteSkillSchema,
  async execute(ctx, { name }) {
    const guard = await checkSelfModAllowed(ctx.agentId);
    if (!guard.allowed) return { ok: false, error: guard.error };

    const existing = await prisma.agentSkill.findUnique({
      where: { agentId_name: { agentId: ctx.agentId, name } },
    });
    if (!existing) return { ok: false, error: `skill '${name}' not found` };

    await prisma.agentSkill.delete({
      where: { agentId_name: { agentId: ctx.agentId, name } },
    });

    await recordModification({
      agentId: ctx.agentId,
      tickNumber: ctx.tickNumber,
      tool: "delete_skill",
      before: {
        skillId: existing.id,
        name: existing.name,
        description: existing.description,
        body: existing.body,
      },
      after: null,
    });
    return { ok: true };
  },
};
registerTool(deleteSkillTool);

// run_skill
const runSkillSchema = z.object({ name: z.string() });
const runSkillTool: ToolDef<typeof runSkillSchema> = {
  slug: "run_skill",
  description:
    "Load a previously-saved skill's body and use it as context for your next reasoning. Returns the skill body as text.",
  schema: runSkillSchema,
  async execute(ctx, { name }) {
    const skill = await prisma.agentSkill.findUnique({
      where: { agentId_name: { agentId: ctx.agentId, name } },
    });
    if (!skill) return { ok: false, error: `skill '${name}' not found` };

    await prisma.agentSkill.update({
      where: { agentId_name: { agentId: ctx.agentId, name } },
      data: { lastUsedAt: new Date() },
    });

    return { ok: true, data: { body: skill.body, description: skill.description } };
  },
};
registerTool(runSkillTool);
