import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, MessageSquare, Clock, Zap, DollarSign, Brain, FileText, Cpu } from "lucide-react";
import { ModelPricing } from "@/components/analytics/model-pricing";
import { MemoryGraph } from "@/components/analytics/memory-graph";

async function getAnalytics(userId: string) {
  const [
    totalQueries,
    queryHistory,
    totalSessions,
    totalReports,
    totalArtifacts,
    totalFiles,
  ] = await Promise.all([
    prisma.queryHistory.count({ where: { userId } }),
    prisma.queryHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        query: true,
        tier: true,
        tokensUsed: true,
        cost: true,
        latencyMs: true,
        cached: true,
        agentsUsed: true,
        confidence: true,
        createdAt: true,
      },
    }),
    prisma.chatSession.count({ where: { userId } }),
    prisma.presentation.count({ where: { userId } }),
    prisma.contentOutput.count({ where: { userId } }),
    prisma.fileUpload.count({ where: { userId } }),
  ]);

  const totalTokens = queryHistory.reduce((sum, q) => sum + q.tokensUsed, 0);
  const totalCost = queryHistory.reduce((sum, q) => sum + q.cost, 0);
  const avgLatency = queryHistory.length > 0
    ? Math.round(queryHistory.reduce((sum, q) => sum + q.latencyMs, 0) / queryHistory.length)
    : 0;

  // Token usage per agent/model
  const agentUsage: Record<string, number> = {};
  for (const q of queryHistory) {
    for (const agent of q.agentsUsed) {
      agentUsage[agent] = (agentUsage[agent] ?? 0) + 1;
    }
  }

  // Tier breakdown
  const tierBreakdown: Record<number, number> = {};
  for (const q of queryHistory) {
    tierBreakdown[q.tier] = (tierBreakdown[q.tier] ?? 0) + 1;
  }

  return {
    totalQueries,
    totalTokens,
    totalCost,
    avgLatency,
    totalSessions,
    totalReports,
    totalArtifacts,
    totalFiles,
    agentUsage,
    tierBreakdown,
    recentQueries: queryHistory,
  };
}

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <Card className="border-[#0085CF]/10 bg-white shadow-sm">
      <CardContent className="flex items-center gap-3 pt-6">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#0085CF]/10">
          <Icon className="size-5 text-[#0085CF]" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
          {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function TierLabel(tier: number) {
  const labels: Record<number, string> = { 0: "Conversation", 1: "Simple", 2: "Moderate", 3: "Deep Research" };
  return labels[tier] ?? `Tier ${tier}`;
}

export default async function AnalyticsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const data = await getAnalytics(session.user.id);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
        <p className="text-gray-500 mt-1">Usage statistics and insights.</p>
      </div>
      <div className="h-px bg-[#0085CF]/10" />

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={MessageSquare} label="Total Queries" value={String(data.totalQueries)} />
        <StatCard icon={Clock} label="Avg Response" value={data.avgLatency > 0 ? `${(data.avgLatency / 1000).toFixed(1)}s` : "—"} />
        <StatCard icon={Brain} label="Total Tokens" value={data.totalTokens > 1000 ? `${(data.totalTokens / 1000).toFixed(1)}k` : String(data.totalTokens)} />
        <StatCard icon={DollarSign} label="Total Cost" value={data.totalCost > 0 ? `$${data.totalCost.toFixed(2)}` : "$0.00"} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Reports" value={String(data.totalReports)} />
        <StatCard icon={Zap} label="Artifacts" value={String(data.totalArtifacts)} />
        <StatCard icon={BarChart3} label="Chat Sessions" value={String(data.totalSessions)} />
        <StatCard icon={Cpu} label="Files Uploaded" value={String(data.totalFiles)} />
      </div>

      {/* Tier breakdown */}
      {Object.keys(data.tierBreakdown).length > 0 && (
        <Card className="border-[#0085CF]/10 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900">Query Tier Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(data.tierBreakdown)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([tier, count]) => {
                  const pct = data.totalQueries > 0 ? (count / data.totalQueries) * 100 : 0;
                  return (
                    <div key={tier}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-700">{TierLabel(Number(tier))}</span>
                        <span className="text-gray-500">{count} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[#0085CF]/10 overflow-hidden">
                        <div className="h-full rounded-full bg-[#0085CF]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Model/Agent usage */}
      {Object.keys(data.agentUsage).length > 0 && (
        <Card className="border-[#0085CF]/10 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900">Model Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.agentUsage)
                .sort(([, a], [, b]) => b - a)
                .map(([agent, count]) => (
                  <div key={agent} className="rounded-lg border border-[#0085CF]/10 bg-[#0085CF]/5 px-3 py-2">
                    <p className="text-xs font-medium text-[#0085CF]">{agent}</p>
                    <p className="text-lg font-bold text-gray-900">{count}</p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent queries */}
      <Card className="border-[#0085CF]/10 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-gray-900">Recent Queries</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentQueries.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-[#0085CF]/20">
              <p className="text-sm text-gray-400">No queries yet. Start chatting to see analytics.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.recentQueries.map((q) => (
                <div key={q.id} className="rounded-lg border border-[#0085CF]/10 p-3">
                  <p className="text-sm font-medium text-gray-800 line-clamp-1">{q.query}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                    <span className="rounded bg-[#0085CF]/10 px-1.5 py-0.5 text-[#0085CF] font-medium">
                      Tier {q.tier}
                    </span>
                    <span>{q.tokensUsed.toLocaleString()} tokens</span>
                    <span>${q.cost.toFixed(4)}</span>
                    <span>{(q.latencyMs / 1000).toFixed(1)}s</span>
                    {q.cached && <span className="text-emerald-600">cached</span>}
                    {q.confidence != null && <span>conf: {(q.confidence * 100).toFixed(0)}%</span>}
                    <span className="ml-auto">{new Date(q.createdAt).toLocaleDateString()}</span>
                  </div>
                  {q.agentsUsed.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {q.agentsUsed.map((a) => (
                        <span key={a} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{a}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Memory graph */}
      <MemoryGraph />

      {/* Model pricing from OpenRouter */}
      <ModelPricing />
    </div>
  );
}
