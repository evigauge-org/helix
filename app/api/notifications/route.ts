// app/api/notifications/route.ts
//
// Feed endpoint for the global bell. Preferences live at
// /api/settings/notifications; this one only reads the derived feed and marks
// it read, so the bell stays cheap to poll.
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  getNotifications, setPrefs, isNotificationsUnavailable,
} from "@/lib/notifications/feed";

// The bell is chrome on every authenticated page, so an unavailable
// UserNotificationPref must degrade to "no notifications" rather than surface
// an error app-wide.

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const { items, unreadCount } = await getNotifications(session.user.id, { limit: 12 });
    return NextResponse.json({ items, unreadCount });
  } catch (e) {
    if (isNotificationsUnavailable(e)) {
      return NextResponse.json({ items: [], unreadCount: 0, migrationPending: true });
    }
    throw e;
  }
}

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    await setPrefs(session.user.id, { lastReadAt: new Date() });
    const { items, unreadCount } = await getNotifications(session.user.id, { limit: 12 });
    return NextResponse.json({ ok: true, items, unreadCount });
  } catch (e) {
    if (isNotificationsUnavailable(e)) {
      return NextResponse.json({ ok: false, items: [], unreadCount: 0, migrationPending: true });
    }
    throw e;
  }
}
