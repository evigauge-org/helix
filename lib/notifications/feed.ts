// lib/notifications/feed.ts
//
// Notifications are DERIVED, not stored. Every item is computed on read from
// rows the runtime already writes (AgentRun, AgentRunReview, AgentModification),
// so there is no event table to keep in sync and no risk of the feed drifting
// from what actually happened. UserNotificationPref holds only the per-source
// toggles plus `lastReadAt`, which is what makes the unread count possible.
import { prisma } from "@/lib/prisma";

export const NOTIFICATION_SOURCES = [
  "agentRunCompleted",
  "agentRunFailed",
  "reviewPending",
  "agentModified",
] as const;

export type NotificationSource = (typeof NOTIFICATION_SOURCES)[number];

export type NotificationPrefs = Record<NotificationSource, boolean> & {
  lastReadAt: string | null;
};

export const DEFAULT_PREFS: NotificationPrefs = {
  agentRunCompleted: true,
  agentRunFailed: true,
  reviewPending: true,
  agentModified: false,
  lastReadAt: null,
};

export type NotificationItem = {
  id: string;
  source: NotificationSource;
  title: string;
  body: string | null;
  href: string;
  createdAt: string;
  unread: boolean;
};

// AgentRun.status values written by lib/agents/runner.ts and the AEP handlers.
const FAILED_STATUSES = ["output_invalid", "stopped"];

/**
 * Thrown when UserNotificationPref cannot be reached. Two distinct causes, and
 * callers treat them the same way — degrade to "no notifications" and tell the
 * user to migrate:
 *   - `prisma generate` has not run: the delegate is `undefined`, so calling it
 *     throws a bare TypeError with no error code.
 *   - `prisma migrate` has not run: the delegate exists but the table does not,
 *     so Prisma raises P2021.
 */
export class NotificationsUnavailableError extends Error {
  constructor() {
    super("UserNotificationPref is unavailable — run: bunx prisma migrate dev");
    this.name = "NotificationsUnavailableError";
  }
}

export function isNotificationsUnavailable(e: unknown): boolean {
  if (e instanceof NotificationsUnavailableError) return true;
  const code = (e as { code?: string } | null)?.code;
  return code === "P2021" || code === "P2022";
}

type PrefRow = {
  agentRunCompleted: boolean;
  agentRunFailed: boolean;
  reviewPending: boolean;
  agentModified: boolean;
  lastReadAt: Date | null;
};

type PrefPatch = Partial<Record<NotificationSource, boolean>> & { lastReadAt?: Date };

type PrefDelegate = {
  findUnique(args: { where: { userId: string } }): Promise<PrefRow | null>;
  upsert(args: {
    where: { userId: string };
    create: PrefPatch & { userId: string };
    update: PrefPatch;
  }): Promise<PrefRow>;
};

// Reached through a narrow typed view rather than `prisma.userNotificationPref`
// directly: the generated client has no such property until `prisma generate`
// picks up the model, which would otherwise be both a compile error and an
// uncatchable TypeError at runtime.
function prefDelegate(): PrefDelegate {
  const delegate = (prisma as unknown as { userNotificationPref?: PrefDelegate })
    .userNotificationPref;
  if (!delegate) throw new NotificationsUnavailableError();
  return delegate;
}

export async function getPrefs(userId: string): Promise<NotificationPrefs> {
  const row = await prefDelegate().findUnique({ where: { userId } });
  if (!row) return DEFAULT_PREFS;
  return {
    agentRunCompleted: row.agentRunCompleted,
    agentRunFailed: row.agentRunFailed,
    reviewPending: row.reviewPending,
    agentModified: row.agentModified,
    lastReadAt: row.lastReadAt?.toISOString() ?? null,
  };
}

export async function setPrefs(
  userId: string,
  patch: PrefPatch,
): Promise<NotificationPrefs> {
  await prefDelegate().upsert({
    where: { userId },
    create: { userId, ...patch },
    update: patch,
  });
  return getPrefs(userId);
}

/**
 * Build the feed for a user, honouring their toggles. A disabled source
 * contributes nothing — the toggle genuinely gates delivery rather than only
 * hiding a row after the fact.
 */
export async function getNotifications(
  userId: string,
  opts: { limit?: number } = {},
): Promise<{ items: NotificationItem[]; unreadCount: number; prefs: NotificationPrefs }> {
  const limit = opts.limit ?? 30;
  const prefs = await getPrefs(userId);
  const readAt = prefs.lastReadAt ? new Date(prefs.lastReadAt) : null;
  const items: NotificationItem[] = [];

  const wantRuns = prefs.agentRunCompleted || prefs.agentRunFailed;

  const [runs, reviews, mods] = await Promise.all([
    wantRuns
      ? prisma.agentRun.findMany({
          where: {
            userId,
            status: {
              in: [
                ...(prefs.agentRunCompleted ? ["completed"] : []),
                ...(prefs.agentRunFailed ? FAILED_STATUSES : []),
              ],
            },
            completedAt: { not: null },
          },
          orderBy: { completedAt: "desc" },
          take: limit,
          select: {
            id: true, status: true, completedAt: true, finalMessage: true,
            totalSteps: true, agent: { select: { id: true, name: true } },
          },
        })
      : [],

    prefs.reviewPending
      ? prisma.agentRunReview.findMany({
          where: { status: "pending", run: { userId } },
          orderBy: { createdAt: "desc" },
          take: limit,
          select: {
            id: true, createdAt: true, outputSummary: true,
            agent: { select: { name: true } },
          },
        })
      : [],

    prefs.agentModified
      ? prisma.agentModification.findMany({
          where: { agent: { userId } },
          orderBy: { createdAt: "desc" },
          take: limit,
          select: {
            id: true, createdAt: true, tool: true, tickNumber: true,
            agent: { select: { id: true, name: true } },
          },
        })
      : [],
  ]);

  for (const run of runs) {
    const failed = FAILED_STATUSES.includes(run.status);
    if (failed && !prefs.agentRunFailed) continue;
    if (!failed && !prefs.agentRunCompleted) continue;
    const at = run.completedAt ?? new Date();
    items.push({
      id: `run:${run.id}`,
      source: failed ? "agentRunFailed" : "agentRunCompleted",
      title: failed
        ? `${run.agent.name} ended as "${run.status}"`
        : `${run.agent.name} finished a run`,
      body: run.finalMessage?.slice(0, 180) ?? `${run.totalSteps} steps`,
      href: `/agents/${run.agent.id}`,
      createdAt: at.toISOString(),
      unread: !readAt || at > readAt,
    });
  }

  for (const review of reviews) {
    items.push({
      id: `review:${review.id}`,
      source: "reviewPending",
      title: `${review.agent.name} is waiting on your review`,
      body: review.outputSummary?.slice(0, 180) ?? null,
      href: "/reviews",
      createdAt: review.createdAt.toISOString(),
      unread: !readAt || review.createdAt > readAt,
    });
  }

  for (const mod of mods) {
    items.push({
      id: `mod:${mod.id}`,
      source: "agentModified",
      title: `${mod.agent.name} changed itself`,
      body: `Used ${mod.tool} on tick ${mod.tickNumber}.`,
      href: `/agents/${mod.agent.id}`,
      createdAt: mod.createdAt.toISOString(),
      unread: !readAt || mod.createdAt > readAt,
    });
  }

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const trimmed = items.slice(0, limit);

  return {
    items: trimmed,
    unreadCount: trimmed.filter((i) => i.unread).length,
    prefs,
  };
}
