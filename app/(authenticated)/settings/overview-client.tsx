"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, Brain, Bot, ClipboardCheck, Cpu, Key, Loader2, MessagesSquare,
  PauseCircle, PlayCircle, Plug, ShieldCheck, Sparkles, Trash2, ArrowRight,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useUIStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";
import { SettingsHeader } from "./settings-ui";

type Source = "agentRunCompleted" | "agentRunFailed" | "reviewPending" | "agentModified";

type Overview = {
  usage: {
    totalQueries: number; queriesLast30: number; chatSessions: number;
    agents: number; runsLast30: number; pendingReviews: number;
    lastActiveAt: string | null;
  };
  memory: { facts: number };
  connections: { apiKeys: number; llmProviders: number; connectedApps: number };
  privacy: { subjects: number };
  profile: { preferredLength: string; tone: string; primaryLanguage: string };
  notifications: { prefs: Record<Source, boolean> & { lastReadAt: string | null }; ready: boolean };
};

const NOTIF_LABELS: { key: Source; label: string }[] = [
  { key: "agentRunCompleted", label: "Run finished" },
  { key: "agentRunFailed", label: "Run failed or stopped" },
  { key: "reviewPending", label: "Review awaiting me" },
  { key: "agentModified", label: "Agent changed itself" },
];

function Stat({
  icon: Icon, label, value, hint, href, accent,
}: {
  icon: typeof Bot; label: string; value: number | string;
  hint?: string; href?: string; accent?: boolean;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-2">
        <Icon className={cn("size-3.5", accent ? "text-amber-600" : "text-[#0085CF]")} />
        <span className="truncate text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className={cn("mt-1.5 text-2xl font-semibold leading-none", accent ? "text-amber-600" : "text-gray-900")}>
        {value}
      </p>
      {hint ? <p className="mt-1 truncate text-[11px] text-gray-400">{hint}</p> : null}
    </>
  );

  const cls = cn(
    "rounded-xl border bg-card p-3.5 shadow-sm transition-all",
    accent ? "border-amber-300/60" : "border-[#0085CF]/10",
    href && "hover:border-[#0085CF]/30 hover:shadow-md",
  );

  return href ? <Link href={href} className={cn(cls, "block")}>{inner}</Link> : <div className={cls}>{inner}</div>;
}

function Panel({
  title, icon: Icon, href, linkLabel, children,
}: {
  title: string; icon: typeof Bot; href?: string; linkLabel?: string; children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-xl border border-[#0085CF]/10 bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-[#0085CF]" />
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        </div>
        {href ? (
          <Link
            href={href}
            className="flex items-center gap-1 text-xs font-medium text-[#0085CF] hover:underline"
          >
            {linkLabel ?? "Open"} <ArrowRight className="size-3" />
          </Link>
        ) : null}
      </div>
      <div className="flex-1 px-4 py-3">{children}</div>
    </section>
  );
}

export function SettingsOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Source | null>(null);
  const memoryPaused = useUIStore((s) => s.memoryPaused);
  const setMemoryPaused = useUIStore((s) => s.setMemoryPaused);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/overview");
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleNotif(key: Source, value: boolean) {
    setBusy(key);
    setData((d) =>
      d ? { ...d, notifications: { ...d.notifications, prefs: { ...d.notifications.prefs, [key]: value } } } : d,
    );
    try {
      await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
    } finally {
      setBusy(null);
      void load();
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <SettingsHeader title="Overview" description="Your account at a glance." />
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="size-4 animate-spin" /> Loading your account…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <SettingsHeader title="Overview" description="Your account at a glance." />
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error ?? "No data"}</span>
        </div>
      </div>
    );
  }

  const { usage, memory, connections, privacy, profile, notifications } = data;
  const lastActive = usage.lastActiveAt
    ? new Date(usage.lastActiveAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "no activity yet";

  return (
    <div className="space-y-5">
      <SettingsHeader
        title="Overview"
        description="Your account at a glance — usage, memory, and what reaches you."
      />

      {/* Usage — one row, no scrolling required to take it in. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat
          icon={MessagesSquare} label="Queries" value={usage.totalQueries}
          hint={`${usage.queriesLast30} in last 30d`}
        />
        <Stat
          icon={Sparkles} label="Conversations" value={usage.chatSessions}
          hint={`last active ${lastActive}`}
        />
        <Stat
          icon={Bot} label="Agents" value={usage.agents}
          hint={`${usage.runsLast30} runs in 30d`} href="/agents"
        />
        <Stat
          icon={ClipboardCheck} label="Reviews waiting" value={usage.pendingReviews}
          hint={usage.pendingReviews > 0 ? "needs your decision" : "all clear"}
          href="/reviews" accent={usage.pendingReviews > 0}
        />
        <Stat
          icon={Brain} label="Memory facts" value={memory.facts}
          hint={memoryPaused ? "capture paused" : "capturing"} href="/settings/memory"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Memory controls — inline, because pausing capture is the single
            most common reason people open settings at all. */}
        <Panel title="Memory" icon={Brain} href="/settings/memory" linkLabel="Manage">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-gray-900">
                {memory.facts === 0
                  ? "Nothing remembered yet."
                  : `${memory.facts} fact${memory.facts === 1 ? "" : "s"} remembered about you.`}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {memoryPaused
                  ? "Capture is paused — new conversations won't add facts."
                  : "Helix is learning from your conversations."}
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {memoryPaused ? "Paused" : "Active"}
            </Badge>
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={() => setMemoryPaused(!memoryPaused)}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
            >
              {memoryPaused ? <PlayCircle className="size-3.5" /> : <PauseCircle className="size-3.5" />}
              {memoryPaused ? "Resume capture" : "Pause capture"}
            </button>
            <Link
              href="/settings/memory"
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:border-red-200 hover:bg-red-50"
            >
              <Trash2 className="size-3.5" /> Review &amp; delete
            </Link>
          </div>
          <p className="mt-2 text-[11px] text-gray-400">
            Pause applies to this browser session.
          </p>
        </Panel>

        {/* Notification toggles — same switches as the dedicated page. */}
        <Panel title="Notifications" icon={ClipboardCheck} href="/settings/notifications" linkLabel="All settings">
          {notifications.ready ? (
            <div className="divide-y divide-gray-100">
              {NOTIF_LABELS.map((n) => (
                <div key={n.key} className="flex items-center justify-between gap-3 py-2">
                  <label htmlFor={`ov-${n.key}`} className="text-sm text-gray-700">
                    {n.label}
                  </label>
                  <div className="flex items-center gap-2">
                    {busy === n.key ? <Loader2 className="size-3 animate-spin text-gray-400" /> : null}
                    <Switch
                      id={`ov-${n.key}`}
                      size="sm"
                      checked={notifications.prefs[n.key]}
                      onCheckedChange={(v) => void toggleNotif(n.key, v)}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Run <code className="font-mono">bunx prisma migrate dev</code> to enable notification
                preferences.
              </span>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Connections" icon={Plug}>
          <div className="grid grid-cols-3 gap-2">
            <Link href="/settings/llm-providers" className="rounded-lg border border-gray-100 p-2.5 transition hover:border-[#0085CF]/30 hover:bg-gray-50">
              <Cpu className="size-3.5 text-[#0085CF]" />
              <p className="mt-1 text-lg font-semibold leading-none text-gray-900">{connections.llmProviders}</p>
              <p className="mt-0.5 text-[11px] text-gray-500">LLM providers</p>
            </Link>
            <Link href="/settings/api-keys" className="rounded-lg border border-gray-100 p-2.5 transition hover:border-[#0085CF]/30 hover:bg-gray-50">
              <Key className="size-3.5 text-[#0085CF]" />
              <p className="mt-1 text-lg font-semibold leading-none text-gray-900">{connections.apiKeys}</p>
              <p className="mt-0.5 text-[11px] text-gray-500">API keys</p>
            </Link>
            <Link href="/settings/connected-apps" className="rounded-lg border border-gray-100 p-2.5 transition hover:border-[#0085CF]/30 hover:bg-gray-50">
              <Plug className="size-3.5 text-[#0085CF]" />
              <p className="mt-1 text-lg font-semibold leading-none text-gray-900">{connections.connectedApps}</p>
              <p className="mt-0.5 text-[11px] text-gray-500">Connected apps</p>
            </Link>
          </div>
        </Panel>

        <Panel title="How Helix writes to you" icon={Sparkles} href="/settings/account" linkLabel="Change">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="capitalize">{profile.preferredLength}</Badge>
            <Badge variant="secondary" className="capitalize">{profile.tone} tone</Badge>
            <Badge variant="secondary" className="uppercase">{profile.primaryLanguage}</Badge>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-3.5 text-[#0085CF]" />
              <span className="text-xs text-gray-600">
                {privacy.subjects} data subject{privacy.subjects === 1 ? "" : "s"} under GDPR control
              </span>
            </div>
            <Link href="/settings/privacy" className="text-xs font-medium text-[#0085CF] hover:underline">
              Privacy
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}
