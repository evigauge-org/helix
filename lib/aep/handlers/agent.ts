// lib/aep/handlers/agent.ts
import { prisma } from "@/lib/prisma";
import { newAepId } from "../ids";
import { AepError } from "../errors";
import type { AepContext } from "../context";

interface Ceilings {
  max_cycles: number;
  max_subagents: number;
  max_tool_calls_per_cycle: number;
  max_wall_seconds: number;
}
interface Budgets {
  tokens_per_cycle: number;
  tool_calls_per_cycle: number;
  seconds_per_cycle: number;
}

// Plan 5 / Phase 6 (external MCP attachment). The auth shape is opaque per
// spec §11; minimum-viable shape is {bearer}, with Record<string,string>
// custom headers for things like API-key headers some MCP servers use.
interface ExternalMcpServerSpec {
  url: string;
  auth?: { bearer?: string; headers?: Record<string, string> };
  name?: string;
}

function deriveServerName(spec: ExternalMcpServerSpec): string {
  if (spec.name && spec.name.trim()) return spec.name.trim();
  try {
    return new URL(spec.url).hostname;
  } catch {
    return "server";
  }
}

export async function agentCreate(
  params: {
    name: string;
    constitution: { immutable_directives: string; mutable_prompt: string; mutable_prompt_policy: "auto" | "approval_required" | "locked" };
    toolset: string[];
    ceilings: Ceilings;
    budgets: Budgets;
    subject_ids?: string[];
    metadata?: Record<string, unknown>;
    external_mcp_servers?: ExternalMcpServerSpec[];
    runner?: { provider_id?: string; model?: string };
  },
  ctx: AepContext,
) {
  const aepId = newAepId("agt");
  const constitution = await prisma.systemConstitution.findFirst({ orderBy: { version: "desc" } });
  if (!constitution) throw new AepError("lifecycle_conflict", "SystemConstitution not initialized");

  // BYO LLM (Plan 7) — optional `runner` block
  let runnerProviderId: string | null = null;
  let runnerModelOverride: string | undefined;
  let providerDefaultModel: string | null = null;
  const runnerInput = params.runner;
  if (runnerInput && typeof runnerInput === "object") {
    const r = runnerInput;
    if (typeof r.provider_id === "string" && r.provider_id.length > 0) {
      const owned = await prisma.llmProvider.findFirst({
        where: { id: r.provider_id, userId: ctx.userId },
        select: { id: true, defaultModel: true },
      });
      if (!owned) {
        throw new AepError("tool_not_found", `runner.provider_id ${r.provider_id} not found`);
      }
      runnerProviderId = owned.id;
      providerDefaultModel = owned.defaultModel;
    }
    if (typeof r.model === "string" && r.model.length > 0) {
      runnerModelOverride = r.model;
    }
  }

  // Eager-bind: when attaching a provider with no explicit `runner.model`,
  // copy the provider's default_model so the agent doesn't inherit the
  // schema default (an OpenRouter slug that wouldn't route to direct providers).
  let resolvedRunnerModel = runnerModelOverride;
  if (runnerProviderId && resolvedRunnerModel === undefined) {
    if (!providerDefaultModel) {
      throw new AepError(
        "lifecycle_conflict",
        "runner.model required: provider has no default_model configured",
      );
    }
    resolvedRunnerModel = providerDefaultModel;
  }

  const created = await prisma.agent.create({
    data: {
      userId: ctx.userId,
      name: params.name,
      goal: "",                                         // legacy required field; run provides per-run goal
      toolSlugs: params.toolset.map(t => t.replace(/^helix\./, "")),  // legacy; runner still reads this
      toolset: params.toolset,
      systemPromptExtra: params.constitution.mutable_prompt,
      constitutionImmutable: params.constitution.immutable_directives,
      constitutionMutable: params.constitution.mutable_prompt,
      constitutionPolicy: params.constitution.mutable_prompt_policy,
      ceilingsJson: params.ceilings as any,
      budgetsJson: params.budgets as any,
      subjectIds: params.subject_ids ?? [],
      aepMetadata: (params.metadata as any) ?? undefined,
      aepId,
      rootAgentId: aepId,                               // root = self for a top-level create
      createdBy: "aep",                                 // legacy required column; AEP RPC surface
      constitutionVersion: constitution.version,        // legacy required column; pulled from live SystemConstitution
      // Map AEP ceilings to existing legacy columns so the runner works:
      maxStepsPerCycle: params.ceilings.max_tool_calls_per_cycle * 2,   // approx
      maxCycleDurationSecs: params.budgets.seconds_per_cycle,
      maxTokensPerCycle: params.budgets.tokens_per_cycle,
      maxTicks: params.ceilings.max_cycles,
      maxLifetimeDays: Math.ceil(params.ceilings.max_wall_seconds / 86400),
      maxTotalTokens: params.ceilings.max_cycles * params.budgets.tokens_per_cycle,
      runnerProviderId,
      ...(resolvedRunnerModel !== undefined ? { runnerModel: resolvedRunnerModel } : {}),
    },
  });

  // Persist external MCP server attachments (Plan 5 / Phase 6).
  if (params.external_mcp_servers && params.external_mcp_servers.length > 0) {
    for (const spec of params.external_mcp_servers) {
      await prisma.agentExternalMcpServer.create({
        data: {
          agentId: created.id,
          name: deriveServerName(spec),
          url: spec.url,
          authJson: (spec.auth ?? null) as any,
        },
      });
    }
  }

  // Re-fetch with the just-created MCP servers so the response includes them.
  const reloaded = await prisma.agent.findUnique({
    where: { id: created.id },
    include: { externalMcpServers: true },
  });
  return serializeAgent(reloaded ?? created);
}

export async function agentGet(params: { agent_id: string; include?: string[] }, ctx: AepContext) {
  const a = await prisma.agent.findFirst({
    where: { aepId: params.agent_id, userId: ctx.userId },
    include: {
      aepPromptHistory: params.include?.includes("prompt_history") ? { orderBy: { appliedAt: "asc" } } : false,
      externalMcpServers: true,
    },
  });
  if (!a) throw new AepError("tool_not_found", "Agent not found");
  const out = serializeAgent(a);
  if (params.include?.includes("prompt_history")) {
    (out as any).prompt_history = (a as any).aepPromptHistory.map(serializePromptHistoryEntry);
  }
  return out;
}

export async function agentList(
  params: { root_agent_id?: string; parent_agent_id?: string; lifecycle_state?: string; subject_id?: string; cursor?: string; limit?: number },
  ctx: AepContext,
) {
  const where: any = { userId: ctx.userId };
  if (params.root_agent_id) where.rootAgentId = params.root_agent_id;
  if (params.parent_agent_id) where.parentAgentId = params.parent_agent_id;
  if (params.lifecycle_state) where.lifecycleState = params.lifecycle_state;
  if (params.subject_id) where.subjectIds = { has: params.subject_id };
  const take = Math.min(params.limit ?? 50, 200);
  const agents = await prisma.agent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(params.cursor ? { cursor: { aepId: params.cursor }, skip: 1 } : {}),
  });
  const next_cursor = agents.length > take ? agents[take - 1].aepId : null;
  return { agents: agents.slice(0, take).map(serializeAgent), next_cursor };
}

export async function agentUpdate(
  params: { agent_id: string; name?: string; metadata?: Record<string, unknown>; ceilings?: Ceilings; budgets?: Budgets; constitution?: any; external_mcp_servers?: ExternalMcpServerSpec[]; runner?: { provider_id?: string; model?: string } | null },
  ctx: AepContext,
) {
  const a = await prisma.agent.findFirst({ where: { aepId: params.agent_id, userId: ctx.userId } });
  if (!a) throw new AepError("tool_not_found", "Agent not found");

  // Ceilings widening while running is rejected.
  if (params.ceilings) {
    const running = await prisma.agentRun.count({ where: { agentId: a.id, aepState: "running" } });
    if (running > 0) {
      const curr = (a.ceilingsJson as any) ?? {};
      for (const k of ["max_cycles","max_subagents","max_tool_calls_per_cycle","max_wall_seconds"] as const) {
        if ((params.ceilings as any)[k] > (curr as any)[k]) {
          throw new AepError("lifecycle_conflict", `Cannot widen ${k} while agent has running runs`);
        }
      }
    }
  }

  // BYO LLM (Plan 7) — optional `runner` block (three states: omitted / null / object)
  const hasRunnerKey = Object.prototype.hasOwnProperty.call(params, "runner");
  const explicitNullRunner = hasRunnerKey && params.runner === null;
  let runnerProviderId: string | null = null;
  let runnerModelOverride: string | undefined;
  let providerDefaultModel: string | null = null;
  if (params.runner && typeof params.runner === "object") {
    const r = params.runner;
    if (typeof r.provider_id === "string" && r.provider_id.length > 0) {
      const owned = await prisma.llmProvider.findFirst({
        where: { id: r.provider_id, userId: ctx.userId },
        select: { id: true, defaultModel: true },
      });
      if (!owned) {
        throw new AepError("tool_not_found", `runner.provider_id ${r.provider_id} not found`);
      }
      runnerProviderId = owned.id;
      providerDefaultModel = owned.defaultModel;
    }
    if (typeof r.model === "string" && r.model.length > 0) {
      runnerModelOverride = r.model;
    }
  }

  // Eager-bind: attaching a provider with no explicit model copies its
  // default_model so the agent doesn't keep its prior runnerModel (which may
  // be a slug for the wrong provider / managed default).
  let resolvedRunnerModel = runnerModelOverride;
  if (runnerProviderId && resolvedRunnerModel === undefined) {
    if (!providerDefaultModel) {
      throw new AepError(
        "lifecycle_conflict",
        "runner.model required: provider has no default_model configured",
      );
    }
    resolvedRunnerModel = providerDefaultModel;
  }

  const data: any = {};
  if (params.name !== undefined) data.name = params.name;
  if (params.metadata !== undefined) data.aepMetadata = params.metadata;
  if (params.ceilings) data.ceilingsJson = params.ceilings;
  if (params.budgets) data.budgetsJson = params.budgets;
  // constitution updates are handled by modify_own_prompt / approval flow; only direct admin
  // updates to immutable_directives are allowed here (and only when idle).
  if (params.constitution?.immutable_directives !== undefined) {
    const anyRunStarted = await prisma.agentRun.count({ where: { agentId: a.id } });
    if (anyRunStarted > 0) {
      throw new AepError("lifecycle_conflict", "Cannot update immutable_directives after first run has started");
    }
    data.constitutionImmutable = params.constitution.immutable_directives;
  }
  if (params.constitution?.mutable_prompt_policy !== undefined) {
    data.constitutionPolicy = params.constitution.mutable_prompt_policy;
  }
  if (runnerProviderId !== null || explicitNullRunner) {
    data.runnerProviderId = runnerProviderId;
  }
  if (resolvedRunnerModel !== undefined) {
    data.runnerModel = resolvedRunnerModel;
  }

  const updated = await prisma.agent.update({ where: { id: a.id }, data });

  // Diff-replace external MCP servers when the field is provided. Names not
  // in the new list are deleted; names present in both update url + auth.
  if (params.external_mcp_servers !== undefined) {
    const incoming = params.external_mcp_servers.map((s) => ({ ...s, _name: deriveServerName(s) }));
    const existing = await prisma.agentExternalMcpServer.findMany({
      where: { agentId: a.id },
      select: { id: true, name: true },
    });
    const incomingNames = new Set(incoming.map((i) => i._name));
    const toDelete = existing.filter((e) => !incomingNames.has(e.name));
    if (toDelete.length > 0) {
      await prisma.agentExternalMcpServer.deleteMany({
        where: { id: { in: toDelete.map((d) => d.id) } },
      });
    }
    for (const spec of incoming) {
      await prisma.agentExternalMcpServer.upsert({
        where: { agentId_name: { agentId: a.id, name: spec._name } },
        update: { url: spec.url, authJson: (spec.auth ?? null) as any },
        create: {
          agentId: a.id,
          name: spec._name,
          url: spec.url,
          authJson: (spec.auth ?? null) as any,
        },
      });
    }
  }

  const reloaded = await prisma.agent.findUnique({
    where: { id: a.id },
    include: { externalMcpServers: true },
  });
  return serializeAgent(reloaded ?? updated);
}

export async function agentCancel(params: { agent_id: string }, ctx: AepContext) {
  const a = await prisma.agent.findFirst({ where: { aepId: params.agent_id, userId: ctx.userId } });
  if (!a) throw new AepError("tool_not_found", "Agent not found");
  await prisma.$transaction([
    prisma.agentRun.updateMany({ where: { agentId: a.id, aepState: { in: ["running", "sleeping"] } as any }, data: { aepState: "cancelled", status: "stopped" } }),
    prisma.agent.update({ where: { id: a.id }, data: { lifecycleState: "cancelled" } }),
  ]);
  return { ok: true };
}

export async function agentArchive(params: { agent_id: string }, ctx: AepContext) {
  const a = await prisma.agent.findFirst({ where: { aepId: params.agent_id, userId: ctx.userId } });
  if (!a) throw new AepError("tool_not_found", "Agent not found");
  await prisma.agent.update({ where: { id: a.id }, data: { lifecycleState: "archived", deletedAt: new Date() } });
  return { ok: true };
}

function serializeAgent(a: any) {
  return {
    id: a.aepId,
    name: a.name,
    constitution: {
      immutable_directives: a.constitutionImmutable ?? "",
      mutable_prompt: a.constitutionMutable ?? a.systemPromptExtra ?? "",
      mutable_prompt_policy: a.constitutionPolicy,
    },
    toolset: a.toolset && a.toolset.length ? a.toolset : a.toolSlugs.map((s: string) => `helix.${s}`),
    ceilings: a.ceilingsJson ?? null,
    budgets: a.budgetsJson ?? null,
    parent_agent_id: a.parentAgentId,
    root_agent_id: a.rootAgentId,
    lifecycle_state: a.lifecycleState,
    next_wake_at: null,   // populated by run service when inferred from run state
    subject_ids: a.subjectIds ?? [],
    runner: a.runnerProviderId
      ? { provider_id: a.runnerProviderId, model: a.runnerModel }
      : null,
    // Redacted on read — only url + name leave the runtime; never the bearer.
    external_mcp_servers: Array.isArray(a.externalMcpServers)
      ? a.externalMcpServers.map((s: any) => ({ url: s.url, name: s.name, enabled: s.enabled }))
      : [],
    created_at: a.createdAt.toISOString(),
    updated_at: a.updatedAt.toISOString(),
    metadata: a.aepMetadata ?? {},
  };
}

function serializePromptHistoryEntry(e: any) {
  return {
    id: e.aepId,
    agent_id: e.agentId,
    diff: e.diff,
    reason: e.reason,
    approved_by: e.approvedBy ?? null,
    applied_at: e.appliedAt.toISOString(),
  };
}
