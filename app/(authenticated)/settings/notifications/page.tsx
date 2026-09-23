"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, Bell, BellOff, CheckCheck, CircleCheck, CircleX,
  ClipboardCheck, Loader2, Wand2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SettingsHeader, SettingsCard, SettingRow } from "../settings-ui";

type Source = "agentRunCompleted" | "agentRunFailed" | "reviewPending" | "agentModified";

type Prefs = Record<Source, boolean> & { lastReadAt: string | null };

type Item = {
  id: string;
  source: Source;
  title: string;
  body: string | null;
  href: string;
  createdAt: string;
  unread: boolean;
};

const SOURCES: { key: Source; label: string; description: string; icon: typeof Bell }[] = [
  {
    key: "agentRunCompleted",
    label: "Agent run finished",
    description: "An agent completed a run successfully.",
    icon: CircleCheck,
  },
  {
    key: "agentRunFailed",
    label: "Agent run failed or stopped",
    description: "A run ended as output_invalid or was stopped before finishing.",
    icon: CircleX,
  },
  {
    key: "reviewPending",
    label: "Review awaiting you",
    description: "An agent produced output that is blocked until you approve it.",
    icon: ClipboardCheck,
  },
  {
    key: "agentModified",
    label: "Agent changed itself",
    description: "A self-improving agent rewrote its own prompt or tools.",
    icon: Wand2,
  },
];

const ICONS: Record<Source, typeof Bell> = {
  agentRunCompleted: CircleCheck,
  agentRunFailed: CircleX,
  reviewPending: ClipboardCheck,
  agentModified: Wand2,
};

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Source | "markRead" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(
    (data: { prefs: Prefs; items: Item[]; unreadCount: number }) => {
      setPrefs(data.prefs);
      setItems(data.items);
      setUnread(data.unreadCount);
    },
    [],
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/settings/notifications");
      if (!res.ok) {
        // 503 carries the "run the migration" message from the route.
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(b.error ?? `Failed to load (${res.status})`);
      }
      apply(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed");
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(body: Record<string, unknown>, marker: Source | "markRead") {
    setBusy(marker);
    setError(null);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      apply(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
      await load();
    } finally {
      setBusy(null);
    }
  }

  function toggle(key: Source, value: boolean) {
    setPrefs((p) => (p ? { ...p, [key]: value } : p)); // optimistic
    void patch({ [key]: value }, key);
  }

  const allOff = prefs ? SOURCES.every((s) => !prefs[s.key]) : false;

  if (loading) {
    return (
      <div className="space-y-6">
        <SettingsHeader title="Notifications" description="Which agent events reach you." />
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="size-4 animate-spin" /> Loading your preferences…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Notifications"
        description="Which agent events reach you."
        action={
          unread > 0 ? (
            <button
              type="button"
              disabled={busy === "markRead"}
              onClick={() => void patch({ markRead: true }, "markRead")}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              {busy === "markRead" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCheck className="size-4" />
              )}
              Mark all read
            </button>
          ) : null
        }
      />

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
      <SettingsCard
        title="Sources"
        description="Each toggle gates one source. Turning it off stops those events being collected, not just hidden."
        footer={<span className="text-xs text-gray-500">Changes save automatically.</span>}
      >
        <div className="divide-y divide-gray-100">
          {SOURCES.map((s) => (
            <SettingRow
              key={s.key}
              htmlFor={`notif-${s.key}`}
              label={s.label}
              description={s.description}
              control={
                <div className="flex items-center gap-2">
                  {busy === s.key ? <Loader2 className="size-3.5 animate-spin text-gray-400" /> : null}
                  <Switch
                    id={`notif-${s.key}`}
                    checked={prefs?.[s.key] ?? false}
                    onCheckedChange={(v) => toggle(s.key, v)}
                  />
                </div>
              }
            />
          ))}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Your feed"
        description={
          allOff
            ? "Every source is off, so nothing is being collected."
            : "What your current settings let through right now."
        }
      >
        {allOff ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <BellOff className="size-8 text-gray-300" />
            <p className="text-sm text-gray-500">Turn a source on to start seeing events here.</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Bell className="size-8 text-gray-300" />
            <p className="text-sm text-gray-500">Nothing yet.</p>
            <p className="text-xs text-gray-400">
              Events appear here as your agents finish runs and request reviews.
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
                    className="flex items-start gap-3 py-3 transition-colors hover:bg-gray-50/70"
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                        item.source === "agentRunFailed"
                          ? "bg-red-50 text-red-500"
                          : "bg-[#0085CF]/10 text-[#0085CF]",
                      )}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p
                          className={cn(
                            "truncate text-sm text-gray-900",
                            item.unread && "font-semibold",
                          )}
                        >
                          {item.title}
                        </p>
                        {item.unread ? (
                          <Badge variant="secondary" className="shrink-0">New</Badge>
                        ) : null}
                      </div>
                      {item.body ? (
                        <p className="mt-0.5 line-clamp-2 text-sm text-gray-500">{item.body}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 pt-0.5 text-xs text-gray-400">
                      {relative(item.createdAt)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </SettingsCard>
      </div>
    </div>
  );
}
