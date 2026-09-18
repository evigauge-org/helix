// lib/aep/handlers/subject.ts
//
// AEP §7.8 — Subject (compliance / GDPR) handlers.
//
//   subject.read   — DSAR-style snapshot of all records tagged with the
//                    subject_id. Side-effect-free. Artifact content is
//                    truncated for size; use subject.export for full bytes.
//   subject.export — same walk + full artifact bytes (text inline, binary
//                    base64). Side-effect-free.
//   subject.erase  — apply mode (hard_delete | redact) across tagged records.
//                    Multi-subject rows: strip from list. Single-subject rows:
//                    apply mode. Returns a manifest; writes SubjectErasureLog.
//
// All three require the corresponding scope (subject.read / subject.export /
// subject.erase, gated in lib/aep/rpc/dispatch.ts via methodScopeMap from
// Plan 3) and the compliance.gdpr capability (gated via methodCapabilityMap).
//
// Subjects belong to the requesting user (Subject.userId === ctx.userId);
// look-ups always include the userId filter to prevent cross-user reads.

import { prisma } from "@/lib/prisma";
import { AepError } from "../errors";
import type { AepContext } from "../context";

const ARTIFACT_PREVIEW_CHARS = 200;

interface ManifestEntry {
  kind: string;
  id: string;
  aepId?: string | null;
  reason?: string;
}

interface ErasureManifest {
  subject_id: string;
  mode: "hard_delete" | "redact";
  deleted: ManifestEntry[];
  redacted: ManifestEntry[];
  stripped: ManifestEntry[];
  retained: ManifestEntry[];
  performed_at: string;
}

async function loadSubject(subjectAepId: string, userId: string) {
  const subject = await prisma.subject.findFirst({
    where: { aepId: subjectAepId, userId },
  });
  if (!subject) throw new AepError("subject_not_found", `Unknown subject: ${subjectAepId}`);
  return subject;
}

async function walk(subjectAepId: string, userId: string) {
  const [agents, runs, artifacts, memory, messages] = await Promise.all([
    prisma.agent.findMany({
      where: { userId, subjectIds: { has: subjectAepId } },
      select: {
        id: true,
        aepId: true,
        name: true,
        constitutionMutable: true,
        constitutionImmutable: true,
        subjectIds: true,
        createdAt: true,
        lifecycleState: true,
      },
    }),
    prisma.agentRun.findMany({
      where: { agent: { userId }, subjectIds: { has: subjectAepId } },
      select: {
        id: true,
        aepId: true,
        agentId: true,
        finalMessage: true,
        subjectIds: true,
        startedAt: true,
        completedAt: true,
        aepResult: true,
      },
    }),
    prisma.agentArtifact.findMany({
      where: { run: { agent: { userId } }, subjectId: subjectAepId },
    }),
    prisma.aepMemoryRecord.findMany({
      where: { subjectId: subjectAepId, createdByAgentId: { not: undefined } },
    }),
    prisma.agentMessage.findMany({
      where: { fromAgent: { userId }, subjectId: subjectAepId },
      select: {
        id: true,
        aepId: true,
        fromAgentId: true,
        toAgentId: true,
        body: true,
        aepBody: true,
        subjectId: true,
        createdAt: true,
      },
    }),
  ]);

  return { agents, runs, artifacts, memory, messages };
}

export async function subjectRead(
  params: { subject_id: string },
  ctx: AepContext,
) {
  const subject = await loadSubject(params.subject_id, ctx.userId);
  const records = await walk(params.subject_id, ctx.userId);

  return {
    subject_id: subject.aepId,
    metadata: subject.metadata ?? {},
    legal_hold: subject.legalHold,
    records: {
      agents: records.agents,
      runs: records.runs,
      artifacts: records.artifacts.map((a) => ({
        id: a.id,
        aepId: a.aepId,
        runId: a.runId,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        sha256: a.sha256,
        subjectId: a.subjectId,
        createdAt: a.createdAt,
        content_preview:
          a.content && a.content.length > ARTIFACT_PREVIEW_CHARS
            ? `${a.content.slice(0, ARTIFACT_PREVIEW_CHARS)}…[truncated; use subject.export for full content]`
            : a.content,
        has_binary_bytes: !!a.bytes,
      })),
      memory: records.memory,
      messages: records.messages,
    },
    counts: {
      agents: records.agents.length,
      runs: records.runs.length,
      artifacts: records.artifacts.length,
      memory: records.memory.length,
      messages: records.messages.length,
    },
    fetched_at: new Date().toISOString(),
  };
}

export async function subjectExport(
  params: { subject_id: string },
  ctx: AepContext,
) {
  const subject = await loadSubject(params.subject_id, ctx.userId);
  const records = await walk(params.subject_id, ctx.userId);

  return {
    subject_id: subject.aepId,
    metadata: subject.metadata ?? {},
    legal_hold: subject.legalHold,
    portable_format_version: "1",
    records: {
      agents: records.agents,
      runs: records.runs,
      artifacts: records.artifacts.map((a) => ({
        id: a.id,
        aepId: a.aepId,
        runId: a.runId,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        sha256: a.sha256,
        subjectId: a.subjectId,
        createdAt: a.createdAt,
        content: a.content,
        bytes_base64: a.bytes ? Buffer.from(a.bytes).toString("base64") : null,
      })),
      memory: records.memory,
      messages: records.messages,
    },
    counts: {
      agents: records.agents.length,
      runs: records.runs.length,
      artifacts: records.artifacts.length,
      memory: records.memory.length,
      messages: records.messages.length,
    },
    exported_at: new Date().toISOString(),
  };
}

export async function subjectErase(
  params: { subject_id: string; mode?: "hard_delete" | "redact" },
  ctx: AepContext,
): Promise<ErasureManifest> {
  const mode = params.mode ?? "redact";
  if (mode !== "hard_delete" && mode !== "redact") {
    throw new AepError("constitution_policy_violation", `Unknown erasure mode: ${mode}`);
  }
  const subject = await loadSubject(params.subject_id, ctx.userId);

  const manifest: ErasureManifest = {
    subject_id: subject.aepId,
    mode,
    deleted: [],
    redacted: [],
    stripped: [],
    retained: [],
    performed_at: new Date().toISOString(),
  };

  // Legal hold short-circuits — the row is preserved, nothing else touched.
  if (subject.legalHold) {
    manifest.retained.push({
      kind: "subject",
      id: subject.id,
      aepId: subject.aepId,
      reason: "legal_hold",
    });
    await writeErasureLog(ctx.userId, subject, manifest);
    return manifest;
  }

  // 1) Agents — multi-subject. Strip from list when one-of-many; redact PII
  // fields when sole subject (we deliberately do NOT cascade-delete the agent
  // even on hard_delete — its children may belong to other subjects).
  const taggedAgents = await prisma.agent.findMany({
    where: { userId: ctx.userId, subjectIds: { has: subject.aepId } },
  });
  for (const a of taggedAgents) {
    if (a.subjectIds.length > 1) {
      await prisma.agent.update({
        where: { id: a.id },
        data: { subjectIds: { set: a.subjectIds.filter((s) => s !== subject.aepId) } },
      });
      manifest.stripped.push({ kind: "agent", id: a.id, aepId: a.aepId });
    } else {
      // Sole subject: redact PII fields and clear subjectIds, keep row.
      await prisma.agent.update({
        where: { id: a.id },
        data: {
          subjectIds: { set: [] },
          name: "[REDACTED]",
          goal: "[REDACTED]",
          constitutionMutable: "[REDACTED]",
          systemPromptExtra: "[REDACTED]",
        },
      });
      manifest.redacted.push({ kind: "agent", id: a.id, aepId: a.aepId });
    }
  }

  // 2) Runs — multi-subject. Strip-or-(delete|redact) per mode.
  const taggedRuns = await prisma.agentRun.findMany({
    where: { agent: { userId: ctx.userId }, subjectIds: { has: subject.aepId } },
  });
  for (const r of taggedRuns) {
    if (r.subjectIds.length > 1) {
      await prisma.agentRun.update({
        where: { id: r.id },
        data: { subjectIds: { set: r.subjectIds.filter((s) => s !== subject.aepId) } },
      });
      manifest.stripped.push({ kind: "run", id: r.id, aepId: r.aepId });
    } else if (mode === "hard_delete") {
      await prisma.agentRun.delete({ where: { id: r.id } });
      manifest.deleted.push({ kind: "run", id: r.id, aepId: r.aepId });
    } else {
      await prisma.agentRun.update({
        where: { id: r.id },
        data: { finalMessage: "[REDACTED]", aepResult: { redacted: true } as any },
      });
      manifest.redacted.push({ kind: "run", id: r.id, aepId: r.aepId });
    }
  }

  // 3) Artifacts — single-subject. Apply mode.
  const taggedArtifacts = await prisma.agentArtifact.findMany({
    where: { run: { agent: { userId: ctx.userId } }, subjectId: subject.aepId },
  });
  for (const a of taggedArtifacts) {
    if (mode === "hard_delete") {
      await prisma.agentArtifact.delete({ where: { id: a.id } });
      manifest.deleted.push({ kind: "artifact", id: a.id, aepId: a.aepId });
    } else {
      await prisma.agentArtifact.update({
        where: { id: a.id },
        data: { content: "[REDACTED]", bytes: null, sha256: null, sizeBytes: 0 },
      });
      manifest.redacted.push({ kind: "artifact", id: a.id, aepId: a.aepId });
    }
  }

  // 4) Memory — single-subject. Apply mode.
  const taggedMemory = await prisma.aepMemoryRecord.findMany({
    where: { subjectId: subject.aepId },
  });
  for (const m of taggedMemory) {
    if (mode === "hard_delete") {
      await prisma.aepMemoryRecord.delete({ where: { id: m.id } });
      manifest.deleted.push({ kind: "memory", id: m.id, aepId: m.aepId });
    } else {
      await prisma.aepMemoryRecord.update({
        where: { id: m.id },
        data: { value: { redacted: true } as any, embedding: { set: [] } },
      });
      manifest.redacted.push({ kind: "memory", id: m.id, aepId: m.aepId });
    }
  }

  // 5) Messages — single-subject. Apply mode.
  const taggedMessages = await prisma.agentMessage.findMany({
    where: { fromAgent: { userId: ctx.userId }, subjectId: subject.aepId },
  });
  for (const msg of taggedMessages) {
    if (mode === "hard_delete") {
      await prisma.agentMessage.delete({ where: { id: msg.id } });
      manifest.deleted.push({ kind: "message", id: msg.id, aepId: msg.aepId });
    } else {
      await prisma.agentMessage.update({
        where: { id: msg.id },
        data: { body: "[REDACTED]", aepBody: { redacted: true } as any },
      });
      manifest.redacted.push({ kind: "message", id: msg.id, aepId: msg.aepId });
    }
  }

  await writeErasureLog(ctx.userId, subject, manifest);
  return manifest;
}

async function writeErasureLog(
  userId: string,
  subject: { id: string; aepId: string },
  manifest: ErasureManifest,
) {
  await prisma.subjectErasureLog.create({
    data: {
      userId,
      subjectAepId: subject.aepId,
      subjectRowId: subject.id,
      mode: manifest.mode,
      manifest: manifest as unknown as object,
    },
  });
}
