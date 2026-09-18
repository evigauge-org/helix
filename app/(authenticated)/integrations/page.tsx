"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Presentation, Link2, Video, Mail, Check, Loader2, ExternalLink, Sparkles, ShoppingCart, Sheet } from "lucide-react";
import { IntegrationCardMenu } from "@/components/integrations/card-menu";

interface IntegrationItem {
  name: string;
  description: string;
  icon: React.ElementType;
  slug: string;
  checkEndpoint?: string;
  connectEndpoint?: string;
}

const INTEGRATIONS: IntegrationItem[] = [
  {
    name: "Canva",
    description: "Create presentations and slide decks",
    icon: Presentation,
    slug: "canva",
    checkEndpoint: "/api/integrations/canva",
    connectEndpoint: "/api/integrations/canva",
  },
  {
    name: "Gamma AI",
    description: "AI-powered presentations, documents, and web pages",
    icon: Sparkles,
    slug: "gamma",
    checkEndpoint: "/api/integrations/gamma",
  },
  {
    name: "Google Sheets",
    description: "Write Goldman-quality financial spreadsheets",
    icon: Sheet,
    slug: "sheets",
    checkEndpoint: "/api/integrations/sheets",
    connectEndpoint: "/api/integrations/sheets",
  },
  {
    name: "Gmail",
    description: "Send email drafts and newsletters",
    icon: Mail,
    slug: "gmail",
    checkEndpoint: "/api/integrations/gmail",
    connectEndpoint: "/api/integrations/gmail",
  },
  {
    name: "LinkedIn",
    description: "Publish posts and articles directly",
    icon: Link2,
    slug: "linkedin",
  },
  {
    name: "CapCut",
    description: "Generate and edit video content",
    icon: Video,
    slug: "capcut",
  },
  {
    name: "Shopify",
    description: "Create and manage e-commerce stores",
    icon: ShoppingCart,
    slug: "shopify",
    checkEndpoint: "/api/integrations/shopify",
  },
];

function IntegrationCard({ integration }: { integration: IntegrationItem }) {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(!!integration.checkEndpoint);

  useEffect(() => {
    if (!integration.checkEndpoint) return;
    fetch(integration.checkEndpoint)
      .then((r) => r.json())
      .then((d) => setConnected(!!d.connected))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [integration.checkEndpoint]);

  // Re-check connection status
  const recheckStatus = () => {
    if (!integration.checkEndpoint) return;
    fetch(integration.checkEndpoint)
      .then((r) => r.json())
      .then((d) => setConnected(!!d.connected))
      .catch(() => {});
  };

  const handleConnect = async () => {
    if (!integration.connectEndpoint) return;
    setLoading(true);
    try {
      const res = await fetch(integration.connectEndpoint, { method: "POST" });
      const data = await res.json();

      // Already connected — update UI immediately
      if (data.connected) {
        setConnected(true);
        return;
      }

      // OAuth flow — open popup, poll for completion
      if (data.redirectUrl) {
        const popup = window.open(data.redirectUrl, "_blank", "width=600,height=700");
        // Poll every 2s until popup closes or connection is made
        const interval = setInterval(() => {
          if (popup?.closed) {
            clearInterval(interval);
            recheckStatus();
          }
        }, 2000);
        // Also recheck after 30s regardless
        setTimeout(() => { clearInterval(interval); recheckStatus(); }, 30000);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-[#0085CF]/10 bg-white shadow-sm">
      <CardHeader className="flex flex-row items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-[#0085CF]/10">
          <integration.icon className="size-5 text-[#0085CF]" />
        </div>
        <div className="flex-1">
          <CardTitle className="text-gray-900 text-base">{integration.name}</CardTitle>
          <CardDescription className="text-gray-500 text-xs">{integration.description}</CardDescription>
        </div>
        {connected && integration.checkEndpoint ? (
          <IntegrationCardMenu
            toolkit={integration.slug}
            displayName={integration.name}
            onDisconnected={() => setConnected(false)}
          />
        ) : null}
      </CardHeader>
      <CardContent>
        {checking ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="size-4 animate-spin" /> Checking...
          </div>
        ) : connected ? (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-700">
            <Check className="size-4" /> Connected
          </div>
        ) : integration.connectEndpoint ? (
          <button
            onClick={handleConnect}
            disabled={loading}
            className="w-full rounded-lg border border-[#0085CF]/20 bg-[#0085CF]/5 px-4 py-2 text-sm font-medium text-[#0085CF] hover:bg-[#0085CF]/10 transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <><Loader2 className="size-4 animate-spin" /> Connecting...</>
            ) : (
              <><ExternalLink className="size-4" /> Connect {integration.name}</>
            )}
          </button>
        ) : (
          <button className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-400 cursor-not-allowed">
            Coming soon
          </button>
        )}
      </CardContent>
    </Card>
  );
}

export default function IntegrationsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Integrations</h1>
        <p className="text-gray-500 mt-1">Connect external platforms to enhance your workflow.</p>
      </div>
      <div className="h-px bg-[#0085CF]/10" />

      <div className="grid gap-4 sm:grid-cols-2">
        {INTEGRATIONS.map((integration) => (
          <IntegrationCard key={integration.slug} integration={integration} />
        ))}
      </div>
    </div>
  );
}
