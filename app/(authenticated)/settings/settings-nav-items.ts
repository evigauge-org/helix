// Shared settings navigation data. Deliberately NOT a client module: the
// index page (a server component) and the nav rail (a client component) both
// read it, and routing a plain data list through a client boundary would turn
// every icon into a client reference for no reason.
import {
  UserCog, Bell, Palette, Brain, Key, Plug, ShieldCheck, Cpu, Database,
  type LucideIcon,
} from "lucide-react";

type SettingsNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** One line for the overview cards on /settings. */
  blurb: string;
};

type SettingsNavGroup = { label: string; items: SettingsNavItem[] };

// Grouped so the rail reads as three intents rather than one flat list of
// nine: who you are, what Helix connects to, what it may keep.
export const SETTINGS_NAV: SettingsNavGroup[] = [
  {
    label: "Account",
    items: [
      { title: "General", href: "/settings/account", icon: UserCog, blurb: "Name, avatar, and how Helix writes to you." },
      { title: "Appearance", href: "/settings/appearance", icon: Palette, blurb: "Light, dark, or follow your system." },
      { title: "Notifications", href: "/settings/notifications", icon: Bell, blurb: "Which agent events reach you." },
    ],
  },
  {
    label: "Connections",
    items: [
      { title: "LLM Providers", href: "/settings/llm-providers", icon: Cpu, blurb: "Bring your own model keys." },
      { title: "API Keys", href: "/settings/api-keys", icon: Key, blurb: "Programmatic access for SDKs and agents." },
      { title: "Connected Apps", href: "/settings/connected-apps", icon: Plug, blurb: "Third-party apps with account access." },
      { title: "data.gov.in", href: "/settings/data-gov-in", icon: Database, blurb: "Key for Indian government data tools." },
    ],
  },
  {
    label: "Data",
    items: [
      { title: "Memory", href: "/settings/memory", icon: Brain, blurb: "What Helix remembers about you." },
      { title: "Privacy & DSAR", href: "/settings/privacy", icon: ShieldCheck, blurb: "GDPR rights across your agents' data." },
    ],
  },
];
