"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Loader2, Save, ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { SettingsHeader, SettingsCard, SettingRow } from "../settings-ui";

type Profile = {
  preferredLength: string;
  preferredVocabulary: string;
  tone: string;
  primaryLanguage: string;
  preferredReportFormat: string;
  codeSwitches: boolean;
  totalQueries: number;
  updatedAt: string | null;
};

type AccountUser = {
  name: string | null;
  email: string;
  image: string | null;
  avatarUrl: string | null;
  role: string;
  emailVerified: boolean;
  createdAt: string;
};

const LENGTHS = [
  ["concise", "Concise — get to the point"],
  ["detailed", "Detailed — the default"],
  ["exhaustive", "Exhaustive — leave nothing out"],
] as const;

const VOCABULARIES = [
  ["plain", "Plain — everyday language"],
  ["technical", "Technical — assume domain fluency"],
  ["academic", "Academic — formal and precise"],
] as const;

const TONES = [
  ["casual", "Casual"],
  ["neutral", "Neutral"],
  ["formal", "Formal"],
] as const;

const FORMATS = [
  ["pdf", "PDF"],
  ["docx", "Word (.docx)"],
  ["xlsx", "Excel (.xlsx)"],
  ["md", "Markdown (.md)"],
] as const;

const LANGUAGES = [
  ["en", "English"], ["hi", "हिन्दी — Hindi"], ["ta", "தமிழ் — Tamil"],
  ["te", "తెలుగు — Telugu"], ["bn", "বাংলা — Bengali"], ["mr", "मराठी — Marathi"],
  ["gu", "ગુજરાતી — Gujarati"], ["kn", "ಕನ್ನಡ — Kannada"],
  ["ml", "മലയാളം — Malayalam"], ["pa", "ਪੰਜਾਬੀ — Punjabi"],
] as const;

export default function AccountSettingsPage() {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | "identity" | "prefs">(null);
  const [saved, setSaved] = useState<null | "identity" | "prefs">(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/settings/account");
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = (await res.json()) as { user: AccountUser; profile: Profile };
      setUser(data.user);
      setProfile(data.profile);
      setName(data.user.name ?? "");
      setAvatarUrl(data.user.avatarUrl ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(which: "identity" | "prefs", body: Record<string, unknown>) {
    setBusy(which);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch("/api/settings/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      setSaved(which);
      window.setTimeout(() => setSaved(null), 2500);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
    } finally {
      setBusy(null);
    }
  }

  // Preferences save on change — there is nothing destructive here and an
  // extra Save button per row would be noise.
  function setPref<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
    void save("prefs", { [key]: value });
  }

  const identityDirty =
    !!user && (name !== (user.name ?? "") || avatarUrl !== (user.avatarUrl ?? ""));

  if (loading) {
    return (
      <div className="space-y-6">
        <SettingsHeader title="General" description="Your identity and how Helix writes to you." />
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="size-4 animate-spin" /> Loading your account…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsHeader title="General" description="Your identity and how Helix writes to you." />

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <SettingsCard
          title="Identity"
          description="Shown across Helix and on anything your agents publish."
          footer={
            <>
              {saved === "identity" ? (
                <span className="mr-auto flex items-center gap-1.5 text-sm text-emerald-600">
                  <Check className="size-4" /> Saved
                </span>
              ) : null}
              <button
                type="button"
                disabled={!identityDirty || busy === "identity"}
                onClick={() => void save("identity", { name: name.trim(), avatarUrl: avatarUrl.trim() })}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#0085CF] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#0075b5] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy === "identity" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save changes
              </button>
            </>
          }
        >
          <div className="flex flex-wrap items-start gap-5">
            <Avatar className="size-16 border-2 border-[#0085CF]/20">
              <AvatarImage src={avatarUrl || user?.image || undefined} />
              <AvatarFallback className="bg-[#0085CF]/10 text-xl font-medium text-[#0085CF]">
                {(name || user?.email || "U").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-[240px] flex-1 space-y-3">
              <div>
                <label htmlFor="acct-name" className="mb-1 block text-sm font-medium text-gray-900">
                  Display name
                </label>
                <Input
                  id="acct-name"
                  value={name}
                  maxLength={100}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="How should Helix address you?"
                />
              </div>
              <div>
                <label htmlFor="acct-avatar" className="mb-1 block text-sm font-medium text-gray-900">
                  Avatar URL
                </label>
                <Input
                  id="acct-avatar"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder={user?.image ?? "https://…"}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Leave empty to use the picture from your Google account.
                </p>
              </div>
            </div>
          </div>
        </SettingsCard>

        <SettingsCard
          title="Sign-in"
          description="Managed by Google — change these in your Google account."
        >
          <div className="divide-y divide-gray-100">
            <SettingRow
              label="Email"
              description={user?.email}
              control={
                user?.emailVerified ? (
                  <Badge variant="secondary" className="gap-1">
                    <Check className="size-3" /> Verified
                  </Badge>
                ) : (
                  <Badge variant="secondary">Unverified</Badge>
                )
              }
            />
            <SettingRow
              label="Role"
              description="Determines what you can do across workspaces."
              control={<Badge variant="secondary" className="capitalize">{user?.role}</Badge>}
            />
            <SettingRow
              label="Member since"
              description={
                user
                  ? new Date(user.createdAt).toLocaleDateString(undefined, {
                      year: "numeric", month: "long", day: "numeric",
                    })
                  : undefined
              }
              control={
                <Link
                  href="/profile"
                  className="flex items-center gap-1 text-sm font-medium text-[#0085CF] hover:underline"
                >
                  View profile <ExternalLink className="size-3.5" />
                </Link>
              }
            />
          </div>
        </SettingsCard>
      </div>

      <SettingsCard
        title="Response preferences"
        description="Applied to chat replies and research answers. Agent runs follow their own spec, not these."
        footer={
          saved === "prefs" ? (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600">
              <Check className="size-4" /> Saved
            </span>
          ) : (
            <span className="text-xs text-gray-500">Changes save automatically.</span>
          )
        }
      >
        <div className="grid gap-x-8 sm:grid-cols-2 [&>*]:border-b [&>*]:border-gray-100">
          <SettingRow
            label="Answer length"
            htmlFor="pref-length"
            description="How much detail a normal answer should carry."
            control={
              <NativeSelect
                className="w-56"
                id="pref-length"
                value={profile?.preferredLength}
                onChange={(e) => setPref("preferredLength", e.target.value)}
              >
                  {LENGTHS.map(([v, l]) => (
                    <NativeSelectOption key={v} value={v}>{l}</NativeSelectOption>
                  ))}
              </NativeSelect>
            }
          />
          <SettingRow
            label="Vocabulary"
            htmlFor="pref-vocab"
            description="How much domain knowledge Helix should assume."
            control={
              <NativeSelect
                className="w-56"
                id="pref-vocab"
                value={profile?.preferredVocabulary}
                onChange={(e) => setPref("preferredVocabulary", e.target.value)}
              >
                  {VOCABULARIES.map(([v, l]) => (
                    <NativeSelectOption key={v} value={v}>{l}</NativeSelectOption>
                  ))}
              </NativeSelect>
            }
          />
          <SettingRow
            label="Tone"
            htmlFor="pref-tone"
            description="The register Helix writes in."
            control={
              <NativeSelect
                className="w-56"
                id="pref-tone"
                value={profile?.tone}
                onChange={(e) => setPref("tone", e.target.value)}
              >
                  {TONES.map(([v, l]) => (
                    <NativeSelectOption key={v} value={v}>{l}</NativeSelectOption>
                  ))}
              </NativeSelect>
            }
          />
          <SettingRow
            label="Primary language"
            htmlFor="pref-lang"
            description="Helix answers in this language unless you ask otherwise."
            control={
              <NativeSelect
                className="w-56"
                id="pref-lang"
                value={profile?.primaryLanguage}
                onChange={(e) => setPref("primaryLanguage", e.target.value)}
              >
                  {LANGUAGES.map(([v, l]) => (
                    <NativeSelectOption key={v} value={v}>{l}</NativeSelectOption>
                  ))}
              </NativeSelect>
            }
          />
          <SettingRow
            label="Allow code-switching"
            htmlFor="pref-switch"
            description="Let Helix mix English with your primary language the way you do."
            control={
              <Switch
                id="pref-switch"
                checked={profile?.codeSwitches ?? false}
                onCheckedChange={(v) => setPref("codeSwitches", v)}
              />
            }
          />
          <SettingRow
            label="Default report format"
            htmlFor="pref-format"
            description="Used when an agent exports a document without being told which."
            control={
              <NativeSelect
                className="w-56"
                id="pref-format"
                value={profile?.preferredReportFormat}
                onChange={(e) => setPref("preferredReportFormat", e.target.value)}
              >
                  {FORMATS.map(([v, l]) => (
                    <NativeSelectOption key={v} value={v}>{l}</NativeSelectOption>
                  ))}
              </NativeSelect>
            }
          />
        </div>
      </SettingsCard>
    </div>
  );
}
