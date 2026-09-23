// app/api/settings/notifications/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  getNotifications, setPrefs, isNotificationsUnavailable,
} from "@/lib/notifications/feed";

// Until `prisma migrate` creates UserNotificationPref, every query here fails
// with P2021 (table does not exist). Surfacing that as a distinct status lets
// the settings page say what to do instead of showing a bare 500.

const MIGRATION_MESSAGE =
  "Notification preferences need a database migration. Run: bunx prisma migrate dev --name user_notification_pref";

const patchSchema = z
  .object({
    agentRunCompleted: z.boolean().optional(),
    agentRunFailed: z.boolean().optional(),
    reviewPending: z.boolean().optional(),
    agentModified: z.boolean().optional(),
    markRead: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty_patch" });

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // The settings page shows a live sample of what each toggle currently lets
  // through, so it returns the feed alongside the preferences.
  try {
    const { items, unreadCount, prefs } = await getNotifications(session.user.id, { limit: 8 });
    return NextResponse.json({ prefs, items, unreadCount });
  } catch (e) {
    if (isNotificationsUnavailable(e)) {
      return NextResponse.json({ error: MIGRATION_MESSAGE }, { status: 503 });
    }
    throw e;
  }
}

export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { markRead, ...toggles } = parsed.data;
  try {
    await setPrefs(session.user.id, {
      ...toggles,
      ...(markRead ? { lastReadAt: new Date() } : {}),
    });
    const { items, unreadCount, prefs } = await getNotifications(session.user.id, { limit: 8 });
    return NextResponse.json({ ok: true, prefs, items, unreadCount });
  } catch (e) {
    if (isNotificationsUnavailable(e)) {
      return NextResponse.json({ error: MIGRATION_MESSAGE }, { status: 503 });
    }
    throw e;
  }
}
