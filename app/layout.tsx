import type { Metadata } from "next";
import { Manrope, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans" });
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

// Where this deployment lives. Set NEXT_PUBLIC_SITE_URL in production so
// canonical and Open Graph URLs resolve against the real origin; the docs site
// is the fallback so social cards still resolve for an undeployed checkout.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://evigauge-org.github.io/helix";
const DOCS_URL = "https://evigauge-org.github.io/helix";
const OG_IMAGE = `${DOCS_URL}/images/og-card.png`;

const DESCRIPTION =
  "Helix is the reference runtime for the Agent Execution Protocol (AEP), an open " +
  "protocol for long-lived autonomous agents. Every tool call, argument and result " +
  "is written to an audit trail, and irreversible actions are held for human approval.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Helix — the Agent Execution Protocol runtime",
    template: "%s · Helix",
  },
  description: DESCRIPTION,
  applicationName: "Helix",
  keywords: [
    "Agent Execution Protocol",
    "AEP",
    "autonomous agents",
    "agent runtime",
    "LLM agents",
    "agent audit trail",
    "human-in-the-loop AI",
    "MCP",
    "agent observability",
  ],
  authors: [{ name: "Evigauge Technologies Pvt. Ltd." }],
  creator: "Evigauge Technologies Pvt. Ltd.",
  publisher: "Evigauge Technologies Pvt. Ltd.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Helix",
    title: "Helix — the Agent Execution Protocol runtime",
    description: DESCRIPTION,
    url: "/",
    locale: "en_GB",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Helix — autonomous agents that leave a record. A run timeline showing the agent's reasoning, a knowledge-base lookup and its results.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Helix — the Agent Execution Protocol runtime",
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  category: "technology",
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Helix",
  alternateName: "Agent Execution Protocol reference runtime",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Node.js",
  description: DESCRIPTION,
  url: SITE_URL,
  image: OG_IMAGE,
  softwareHelp: DOCS_URL,
  license: "https://github.com/evigauge-org/helix/blob/main/LICENSE.md",
  author: { "@type": "Organization", name: "Evigauge Technologies Pvt. Ltd." },
  sameAs: [
    "https://github.com/evigauge-org/helix",
    "https://github.com/evigauge-org/helix-sdk",
    "https://www.npmjs.com/package/@helixsdk/core",
    "https://pypi.org/project/helixsdk/",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", manrope.variable)}
    >
      <head>
        <script
          type="application/ld+json"
          // Static object defined above — no user input reaches this string.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
      </head>
      <body suppressHydrationWarning>
        <TooltipProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
