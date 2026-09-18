import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ProvidersTable } from "./providers-table";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LlmProvidersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/");

  const rows = await prisma.llmProvider.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { agents: true } } },
  });

  const initial = rows.map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    base_url: p.baseUrl,
    api_key_hint: p.apiKeyHint,
    default_model: p.defaultModel,
    last_tested_at: p.lastTestedAt?.toISOString() ?? null,
    last_test_status: p.lastTestStatus,
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
    agent_count: p._count.agents,
  }));

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-8">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-[#0085CF] hover:underline">
        <ChevronLeft className="size-4" /> Back to settings
      </Link>
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">LLM Providers</h1>
        <p className="text-gray-500 mt-1">
          Bring your own LLM. Add credentials for Anthropic, OpenAI, OpenRouter, Perplexity, Grok, Gemini, or any custom-hosted OpenAI-compatible endpoint, then attach a provider to an agent at create-time.
        </p>
      </div>
      <div className="h-px bg-[#0085CF]/10" />
      <ProvidersTable initial={initial} />
    </div>
  );
}
