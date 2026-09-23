"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/kbd";
import { SettingsHeader, SettingsCard, SettingRow } from "../settings-ui";

const THEMES = [
  { value: "light", label: "Light", icon: Sun, hint: "Always the light palette." },
  { value: "dark", label: "Dark", icon: Moon, hint: "Always the dark palette." },
  { value: "system", label: "System", icon: Monitor, hint: "Follow your OS setting." },
] as const;

// A miniature of the app chrome so the choice is visible before it is applied.
function ThemePreview({ tone }: { tone: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <div
      className={cn(
        "flex h-16 w-full gap-1.5 overflow-hidden rounded-md border p-1.5",
        dark ? "border-neutral-700 bg-neutral-900" : "border-neutral-200 bg-neutral-50",
      )}
    >
      <div className={cn("w-1/4 rounded-sm", dark ? "bg-neutral-800" : "bg-neutral-200")} />
      <div className="flex flex-1 flex-col gap-1">
        <div className="h-2 w-2/3 rounded-full bg-[#0085CF]/70" />
        <div className={cn("h-1.5 w-full rounded-full", dark ? "bg-neutral-700" : "bg-neutral-300")} />
        <div className={cn("h-1.5 w-4/5 rounded-full", dark ? "bg-neutral-700" : "bg-neutral-300")} />
        <div className={cn("h-1.5 w-1/2 rounded-full", dark ? "bg-neutral-700" : "bg-neutral-300")} />
      </div>
    </div>
  );
}

export default function AppearanceSettingsPage() {
  const { theme, setTheme, resolvedTheme, systemTheme } = useTheme();
  // next-themes only knows the real value after mount; render a stable shell
  // first so the server and client markup agree.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const active = mounted ? (theme ?? "system") : undefined;

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Appearance"
        description="How Helix looks on this device."
      />

      <SettingsCard
        title="Theme"
        description="Stored in this browser — it does not follow you to other devices."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {THEMES.map((opt) => {
            const selected = active === opt.value;
            const previewTone: "light" | "dark" =
              opt.value === "system"
                ? ((mounted ? systemTheme : "light") === "dark" ? "dark" : "light")
                : opt.value;

            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                aria-pressed={selected}
                className={cn(
                  "group cursor-pointer rounded-lg border p-3 text-left transition-all",
                  selected
                    ? "border-[#0085CF] ring-2 ring-[#0085CF]/20"
                    : "border-gray-200 hover:border-gray-300 hover:shadow-sm",
                )}
              >
                <ThemePreview tone={previewTone} />
                <div className="mt-2.5 flex items-center gap-1.5">
                  <opt.icon className={cn("size-4", selected ? "text-[#0085CF]" : "text-gray-400")} />
                  <span
                    className={cn(
                      "text-sm font-medium",
                      selected ? "text-[#0085CF]" : "text-gray-900",
                    )}
                  >
                    {opt.label}
                  </span>
                  {selected ? <Check className="ml-auto size-4 text-[#0085CF]" /> : null}
                </div>
                <p className="mt-0.5 text-xs text-gray-500">{opt.hint}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-4 border-t border-gray-100 pt-3">
          <SettingRow
            label="Keyboard shortcut"
            description="Toggle between light and dark from anywhere, unless you are typing."
            control={<Kbd>D</Kbd>}
            className="py-0"
          />
        </div>
      </SettingsCard>

      <SettingsCard title="Currently applied">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          {mounted ? (
            <>
              {resolvedTheme === "dark" ? (
                <Moon className="size-4 text-[#0085CF]" />
              ) : (
                <Sun className="size-4 text-[#0085CF]" />
              )}
              <span>
                <span className="font-medium text-gray-900 capitalize">{resolvedTheme}</span>
                {active === "system" ? " — matching your operating system." : "."}
              </span>
            </>
          ) : (
            <span className="text-gray-400">Reading your preference…</span>
          )}
        </div>
      </SettingsCard>
    </div>
  );
}
