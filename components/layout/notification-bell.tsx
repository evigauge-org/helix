"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell, CheckCheck, CircleCheck, CircleX, ClipboardCheck, Loader2, Settings2, Wand2,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Source = "agentRunCompleted" | "agentRunFailed" | "reviewPending" | "agentModified";

type Item = {
  id: string;
  source: Source;
  title: string;
  body: string | null;
  href: string;
  createdAt: string;
  unread: boolean;
};

const ICONS: Record<Source, typeof Bell> = {
  agentRunCompleted: CircleCheck,
  agentRunFailed: CircleX,
  reviewPending: ClipboardCheck,
  agentModified: Wand2,
};

function relative(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Global notification bell. Fixed to the top-right on every authenticated
 * screen. Polls quietly while open is false so the badge stays roughly current
 * without hammering the route.
 */
export function NotificationBell() {
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return; // 401 on sign-out — stay silent, this is chrome
      const data = (await res.json()) as { items: Item[]; unreadCount: number };
      setItems(data.items ?? []);
      setUnread(data.unreadCount ?? 0);
    } catch {
      // Network hiccup: keep whatever we last had rather than blanking the bell.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  // Refresh on open so the panel is never staler than the click.
  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function markAllRead() {
    setMarking(true);
    try {
      const res = await fetch("/api/notifications", { method: "POST" });
      if (res.ok) {
        const data = (await res.json()) as { items: Item[]; unreadCount: number };
        setItems(data.items ?? []);
        setUnread(data.unreadCount ?? 0);
      }
    } finally {
      setMarking(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className="fixed top-4 right-4 z-50 flex size-9 cursor-pointer items-center justify-center rounded-full border border-[#0085CF]/20 bg-white/90 text-gray-600 shadow-sm backdrop-blur transition-colors hover:bg-[#0085CF]/5 hover:text-[#0085CF] aria-expanded:bg-[#0085CF]/5 aria-expanded:text-[#0085CF]"
      >
        <Bell className="size-4" />
        {unread > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-[17px] items-center justify-center rounded-full bg-[#0085CF] px-1 text-[10px] font-semibold leading-[17px] text-white ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
          <p className="text-sm font-semibold text-gray-900">Notifications</p>
          <div className="flex items-center gap-1">
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                disabled={marking}
                title="Mark all read"
                className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
              >
                {marking ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCheck className="size-3.5" />}
              </button>
            ) : null}
            <Link
              href="/settings/notifications"
              onClick={() => setOpen(false)}
              title="Notification settings"
              className="flex cursor-pointer items-center rounded-md px-1.5 py-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              <Settings2 className="size-3.5" />
            </Link>
          </div>
        </div>

        <div className="max-h-[380px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
              <Bell className="size-7 text-gray-300" />
              <p className="text-sm text-gray-500">You&apos;re all caught up.</p>
              <p className="text-xs text-gray-400">
                Agent runs and pending reviews will show up here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {items.map((item) => {
                const Icon = ICONS[item.source];
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-start gap-2.5 px-4 py-2.5 transition-colors hover:bg-gray-50",
                        item.unread && "bg-[#0085CF]/[0.03]",
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
                          item.source === "agentRunFailed"
                            ? "bg-red-50 text-red-500"
                            : "bg-[#0085CF]/10 text-[#0085CF]",
                        )}
                      >
                        <Icon className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-sm leading-snug text-gray-900",
                            item.unread && "font-semibold",
                          )}
                        >
                          {item.title}
                        </p>
                        {item.body ? (
                          <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{item.body}</p>
                        ) : null}
                      </div>
                      <span className="shrink-0 pt-0.5 text-[11px] text-gray-400">
                        {relative(item.createdAt)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <Link
          href="/settings/notifications"
          onClick={() => setOpen(false)}
          className="block border-t border-gray-100 px-4 py-2.5 text-center text-xs font-medium text-[#0085CF] transition-colors hover:bg-gray-50"
        >
          Manage notifications
        </Link>
      </PopoverContent>
    </Popover>
  );
}
