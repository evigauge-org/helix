// app/api/settings/overview/route.ts
//
// Everything the Settings overview needs in one round trip. The notification
// block is fetched separately and tolerated as missing, because it is the only
// part that depends on the not-yet-migrated UserNotificationPref table — the
// usage and memory numbers must still render without it.
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getPrefs, DEFAULT_PREFS, isNotificationsUnavailable, type NotificationPrefs,
} from "@/lib/notifications/feed";


export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalQueries, queriesLast30, chatSessions, memoryFacts,
    agents, runsLast30, pendingReviews, apiKeys, llmProviders,
    connectedApps, subjects, profile, lastQuery,
  ] = await prisma.$transaction([
    prisma.queryHistory.count({ where: { userId } }),
    prisma.queryHistory.count({ where: { userId, createdAt: { gte: since } } }),
    prisma.chatSession.count({ where: { userId } }),
    prisma.userMemoryFact.count({ where: { userId } }),
    prisma.agent.count({ where: { userId } }),
    prisma.agentRun.count({ where: { userId, startedAt: { gte: since } } }),
    prisma.agentRunReview.count({ where: { status: "pending", run: { userId } } }),
    prisma.apiKey.count({ where: { referenceId: userId, enabled: true } }),
    prisma.llmProvider.count({ where: { userId } }),
    prisma.oAuthConsent.count({ where: { userId } }),
    prisma.subject.count({ where: { userId } }),
    prisma.userProfile.findUnique({
      where: { userId },
      select: { preferredLength: true, tone: true, primaryLanguage: true },
    }),
    prisma.queryHistory.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  let notificationPrefs: NotificationPrefs = DEFAULT_PREFS;
  let notificationsReady = true;
  try {
    notificationPrefs = await getPrefs(userId);
  } catch (e) {
    if (!isNotificationsUnavailable(e)) throw e;
    notificationsReady = false;
  }

  return NextResponse.json({
    usage: {
      totalQueries,
      queriesLast30,
      chatSessions,
      agents,
      runsLast30,
      pendingReviews,
      lastActiveAt: lastQuery?.createdAt.toISOString() ?? null,
    },
    memory: { facts: memoryFacts },
    connections: { apiKeys, llmProviders, connectedApps },
    privacy: { subjects },
    profile: profile ?? { preferredLength: "detailed", tone: "casual", primaryLanguage: "en" },
    notifications: { prefs: notificationPrefs, ready: notificationsReady },
  });
}
