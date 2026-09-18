"use client";

import { useState } from "react";
import {
  Brain,
  Search,
  FileText,
  Loader2,
  Check,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import type { ResearchProgress, ResearchStepDetail } from "@/lib/types";

// Icon per adaptive-research phase.
const PHASE_ICON: Record<ResearchProgress["phase"], React.ElementType> = {
  searching: Search,
  fetching: FileText,
  planning: Brain,
};

function StepDetailPanel({ detail }: { detail: ResearchStepDetail }) {
  if (detail.kind === "search") {
    return (
      <ul className="mt-1 flex flex-col gap-1">
        {detail.results.length === 0 ? (
          <li className="text-xs text-gray-400">No results.</li>
        ) : (
          detail.results.map((r, i) => (
            <li key={i} className="truncate text-xs">
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0085CF] hover:underline"
                title={r.url}
              >
                {r.title || r.url}
              </a>
            </li>
          ))
        )}
      </ul>
    );
  }
  if (detail.kind === "fetch") {
    return (
      <div className="mt-1 flex flex-col gap-1">
        {detail.title && (
          <div className="text-xs font-medium text-gray-700">{detail.title}</div>
        )}
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-gray-500">
          {detail.excerpt || "No text extracted."}
        </p>
      </div>
    );
  }
  if (detail.kind === "todo") {
    return (
      <ul className="mt-1 flex flex-col gap-1">
        {detail.tasks.length === 0 ? (
          <li className="text-xs text-gray-400">No tasks.</li>
        ) : (
          detail.tasks.map((t, i) => (
            <li key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
              <Check
                className={`size-3 shrink-0 ${t.done ? "text-[#0085CF]" : "text-gray-300"}`}
              />
              <span className={t.done ? "line-through text-gray-400" : ""}>{t.task}</span>
            </li>
          ))
        )}
      </ul>
    );
  }
  // error
  return <p className="mt-1 text-xs text-red-600">{detail.message}</p>;
}

function StepRow({ step, isActive, live }: { step: ResearchProgress; isActive: boolean; live?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = PHASE_ICON[step.phase];
  const hasDetail = !!step.detail;
  // Spinner only for the live, not-yet-done last step; otherwise a muted check.
  const showSpinner = live && isActive && !step.done;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        <div className="relative flex size-4 shrink-0 items-center justify-center">
          {showSpinner ? (
            <Loader2 className="size-3.5 animate-spin text-[#0085CF]" />
          ) : (
            <Check className="size-3.5 text-gray-400" />
          )}
        </div>
        <Icon className={`size-3 shrink-0 ${showSpinner ? "text-[#0085CF]" : "text-gray-400"}`} />
        {hasDetail ? (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="flex min-w-0 flex-1 items-center gap-1 text-left"
          >
            <span
              className={`truncate text-xs ${
                showSpinner ? "helix-shimmer font-medium text-gray-800" : "font-normal text-gray-600"
              }`}
            >
              {step.label}
            </span>
            {expanded ? (
              <ChevronDown className="size-3 shrink-0 text-gray-400" />
            ) : (
              <ChevronRight className="size-3 shrink-0 text-gray-400" />
            )}
          </button>
        ) : (
          <span
            className={`truncate text-xs ${
              showSpinner ? "helix-shimmer font-medium text-gray-800" : "font-normal text-gray-400"
            }`}
          >
            {step.label}
          </span>
        )}
      </div>
      {hasDetail && expanded && (
        <div className="ml-6 mt-1 border-l border-gray-200 pl-2">
          <StepDetailPanel detail={step.detail!} />
        </div>
      )}
    </div>
  );
}

export function ResearchSteps({ steps, live }: { steps: ResearchProgress[]; live?: boolean }) {
  const lastIndex = steps.length - 1;
  return (
    <div className="flex flex-col gap-1.5">
      {steps.map((step, i) => (
        <StepRow key={i} step={step} isActive={i === lastIndex} live={live} />
      ))}
    </div>
  );
}
