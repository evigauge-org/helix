import { TrendingDown, TrendingUp, Bot } from "lucide-react";
import type { OptimizationData } from "@/lib/types";

export function OptimizationCard({ data }: { data: OptimizationData }) {
  return (
    <div className="my-4 rounded-lg border border-border bg-card p-4 space-y-3">
      <p className="font-medium">Business Optimization</p>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-md bg-emerald-500/10 p-3">
          <TrendingDown className="size-5 text-emerald-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-emerald-600">{data.total_cost_savings_estimate}</p>
          <p className="text-xs text-muted-foreground">Cost Savings</p>
        </div>
        <div className="rounded-md bg-blue-500/10 p-3">
          <TrendingUp className="size-5 text-blue-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-blue-600">{data.total_revenue_upside_estimate}</p>
          <p className="text-xs text-muted-foreground">Revenue Upside</p>
        </div>
        <div className="rounded-md bg-violet-500/10 p-3">
          <Bot className="size-5 text-violet-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-violet-600">{data.total_ai_impact_estimate}</p>
          <p className="text-xs text-muted-foreground">AI Impact</p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{data.executive_summary}</p>
    </div>
  );
}
