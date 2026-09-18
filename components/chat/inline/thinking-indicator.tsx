"use client";

import { useState, useEffect } from "react";
import { Brain, Search, FileText, Users, Shield, Sparkles, Check, Loader2 } from "lucide-react";

interface Step {
  icon: React.ElementType;
  label: string;
  detail: string;
  durationMs: number;
}

const TEXT_STEPS: Step[] = [
  { icon: Brain,     label: "Understanding query",        detail: "Parsing intent and context",       durationMs: 2000 },
  { icon: Search,    label: "Searching web sources",      detail: "Exa deep search across the web",   durationMs: 4000 },
  { icon: Users,     label: "Research agent analyzing",    detail: "DeepSeek R1 extracting key data",  durationMs: 5000 },
  { icon: Users,     label: "Analysis agent processing",   detail: "Gemma 4 decomposing findings",     durationMs: 5000 },
  { icon: Users,     label: "Reasoning agent thinking",    detail: "GPT-4o building logical model",    durationMs: 4000 },
  { icon: Sparkles,  label: "Building consensus",         detail: "Agents debating and converging",    durationMs: 6000 },
  { icon: Shield,    label: "Running guardrails",         detail: "Fact-checking and verification",    durationMs: 3000 },
];

const FILE_STEPS: Step[] = [
  { icon: Brain,     label: "Understanding query",        detail: "Parsing intent and context",        durationMs: 2000 },
  { icon: FileText,  label: "Parsing uploaded files",     detail: "PageIndex → Docling → pypdf",       durationMs: 8000 },
  { icon: FileText,  label: "Extracting document data",   detail: "Building chunks and embeddings",    durationMs: 6000 },
  { icon: Search,    label: "Searching web sources",      detail: "Cross-referencing with web data",   durationMs: 4000 },
  { icon: Users,     label: "Research agent analyzing",    detail: "Grounding answer in documents",     durationMs: 8000 },
  { icon: Users,     label: "Analysis agent processing",   detail: "Deep financial/data extraction",    durationMs: 8000 },
  { icon: Users,     label: "Reasoning agent thinking",    detail: "Building quantitative model",       durationMs: 6000 },
  { icon: Sparkles,  label: "Synthesis agent writing",     detail: "Crafting the final answer",         durationMs: 6000 },
  { icon: Sparkles,  label: "Building consensus",         detail: "4-agent debate and convergence",    durationMs: 8000 },
  { icon: Shield,    label: "Running guardrails",         detail: "Hallucination check + fact verify", durationMs: 4000 },
];

export function ThinkingIndicator({ hasFiles }: { hasFiles?: boolean }) {
  const steps = hasFiles ? FILE_STEPS : TEXT_STEPS;
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let idx = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    function scheduleNext() {
      if (idx >= steps.length - 1) {
        // Stay on last step — waiting for response
        return;
      }
      const timer = setTimeout(() => {
        idx++;
        setActiveIndex(idx);
        scheduleNext();
      }, steps[idx].durationMs);
      timers.push(timer);
    }

    scheduleNext();
    return () => timers.forEach(clearTimeout);
  }, [steps]);

  return (
    <div className="my-2 rounded-lg border border-[#0085CF]/15 bg-white overflow-hidden shadow-sm max-w-[400px]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#0085CF]/5 border-b border-[#0085CF]/10">
        <div className="flex size-5 items-center justify-center">
          <Loader2 className="size-4 text-[#0085CF] animate-spin" />
        </div>
        <span className="text-xs font-medium text-gray-700">Helix is thinking...</span>
      </div>

      {/* Steps */}
      <div className="px-3 py-2 space-y-0.5">
        {steps.map((step, i) => {
          const isDone = i < activeIndex;
          const isActive = i === activeIndex;
          const isPending = i > activeIndex;
          const Icon = step.icon;

          return (
            <div
              key={i}
              className={`flex items-center gap-2.5 py-1 transition-all duration-500 ${
                isPending ? "opacity-0 h-0 overflow-hidden" : "opacity-100"
              }`}
            >
              {/* Status icon */}
              <div className="flex size-5 shrink-0 items-center justify-center">
                {isDone && <Check className="size-3.5 text-emerald-500" />}
                {isActive && (
                  <div className="relative flex items-center justify-center">
                    <div className="absolute size-5 rounded-full bg-[#0085CF]/20 animate-ping" />
                    <Icon className="relative size-3.5 text-[#0085CF]" />
                  </div>
                )}
              </div>

              {/* Label + detail */}
              <div className="flex-1 min-w-0">
                <span
                  className={`text-xs font-medium transition-colors duration-300 ${
                    isDone ? "text-emerald-700" : isActive ? "text-gray-800" : "text-gray-400"
                  }`}
                >
                  {step.label}
                </span>
                {isActive && (
                  <span className="text-[10px] text-gray-500 ml-1.5 animate-pulse">
                    {step.detail}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
