import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Bell, Palette, CreditCard, Brain, Key, Plug, ShieldCheck, Cpu, Database } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account and preferences.</p>
      </div>
      <div className="h-px bg-[#0085CF]/10" />

      <Card className="border-[#0085CF]/10 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-[#0085CF]/10">
            <Settings className="size-5 text-[#0085CF]" />
          </div>
          <div>
            <CardTitle className="text-gray-900">Account</CardTitle>
            <CardDescription className="text-gray-500">Your account details and preferences.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400">Account settings coming soon.</p>
        </CardContent>
      </Card>

      <Link href="/settings/memory" className="block">
        <Card className="border-[#0085CF]/10 bg-white shadow-sm transition hover:border-[#0085CF]/30 hover:shadow-md">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#0085CF]/10">
              <Brain className="size-5 text-[#0085CF]" />
            </div>
            <div>
              <CardTitle className="text-gray-900">Memory</CardTitle>
              <CardDescription className="text-gray-500">View, pause, or delete what Helix remembers about you.</CardDescription>
            </div>
          </CardHeader>
        </Card>
      </Link>

      <Link href="/settings/api-keys" className="block">
        <Card className="border-[#0085CF]/10 bg-white shadow-sm transition hover:border-[#0085CF]/30 hover:shadow-md">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#0085CF]/10">
              <Key className="size-5 text-[#0085CF]" />
            </div>
            <div>
              <CardTitle className="text-gray-900">API Keys</CardTitle>
              <CardDescription className="text-gray-500">Programmatic access for the AEP SDK, MCP servers, and third-party agents.</CardDescription>
            </div>
          </CardHeader>
        </Card>
      </Link>

      <Link href="/settings/connected-apps" className="block">
        <Card className="border-[#0085CF]/10 bg-white shadow-sm transition hover:border-[#0085CF]/30 hover:shadow-md">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#0085CF]/10">
              <Plug className="size-5 text-[#0085CF]" />
            </div>
            <div>
              <CardTitle className="text-gray-900">Connected Apps</CardTitle>
              <CardDescription className="text-gray-500">Third-party apps that have access to your Helix account. Review or revoke any time.</CardDescription>
            </div>
          </CardHeader>
        </Card>
      </Link>

      <Link href="/settings/llm-providers" className="block">
        <Card className="border-[#0085CF]/10 bg-white shadow-sm transition hover:border-[#0085CF]/30 hover:shadow-md">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#0085CF]/10">
              <Cpu className="size-5 text-[#0085CF]" />
            </div>
            <div>
              <CardTitle className="text-gray-900">LLM Providers</CardTitle>
              <CardDescription className="text-gray-500">Bring your own LLM keys — Anthropic, OpenAI, Gemini, custom-hosted models. Used by your agents at runtime.</CardDescription>
            </div>
          </CardHeader>
        </Card>
      </Link>

      <Link href="/settings/data-gov-in" className="block">
        <Card className="border-[#0085CF]/10 bg-white shadow-sm transition hover:border-[#0085CF]/30 hover:shadow-md">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#0085CF]/10">
              <Database className="size-5 text-[#0085CF]" />
            </div>
            <div>
              <CardTitle className="text-gray-900">data.gov.in API Key</CardTitle>
              <CardDescription className="text-gray-500">Required for Indian government data tools (RBI rates, MoSPI inflation, GDP, IIP, SEBI mutual fund AUM). Free to register.</CardDescription>
            </div>
          </CardHeader>
        </Card>
      </Link>

      <Link href="/settings/privacy" className="block">
        <Card className="border-[#0085CF]/10 bg-white shadow-sm transition hover:border-[#0085CF]/30 hover:shadow-md">
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#0085CF]/10">
              <ShieldCheck className="size-5 text-[#0085CF]" />
            </div>
            <div>
              <CardTitle className="text-gray-900">Privacy & DSAR</CardTitle>
              <CardDescription className="text-gray-500">Manage subjects and exercise GDPR rights — Read, Export, Erase — across your agents' data.</CardDescription>
            </div>
          </CardHeader>
        </Card>
      </Link>

      <Card className="border-[#0085CF]/10 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-[#0085CF]/10">
            <Bell className="size-5 text-[#0085CF]" />
          </div>
          <div>
            <CardTitle className="text-gray-900">Notifications</CardTitle>
            <CardDescription className="text-gray-500">Configure alerts and monitor notifications.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400">Notification preferences coming soon.</p>
        </CardContent>
      </Card>

      <Card className="border-[#0085CF]/10 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-[#0085CF]/10">
            <Palette className="size-5 text-[#0085CF]" />
          </div>
          <div>
            <CardTitle className="text-gray-900">Appearance</CardTitle>
            <CardDescription className="text-gray-500">Theme, language, and display preferences.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400">Appearance settings coming soon.</p>
        </CardContent>
      </Card>

      <Card className="border-[#0085CF]/10 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-[#0085CF]/10">
            <CreditCard className="size-5 text-[#0085CF]" />
          </div>
          <div>
            <CardTitle className="text-gray-900">Plan & Billing</CardTitle>
            <CardDescription className="text-gray-500">Current plan, usage, and billing.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400">Billing management coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
