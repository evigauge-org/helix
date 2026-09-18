"use client";

import { useRouter } from "next/navigation";
import * as Icons from "lucide-react";
import { ArrowRight, FileText, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type TemplateCardData = {
  slug: string;
  name: string;
  category: string;
  description: string;
  iconName?: string | null;
  docPolicy: "required" | "optional";
  reviewerRoleHint?: string | null;
  version: number;
};

type IconComponent = React.ComponentType<{ className?: string }>;

function iconFor(name: string | null | undefined): IconComponent {
  if (!name) return Icons.Sparkles as unknown as IconComponent;
  const lookup = (Icons as unknown as Record<string, IconComponent>)[name];
  return lookup ?? (Icons.Sparkles as unknown as IconComponent);
}

type CategoryStyle = {
  stripe: string;        // top accent stripe
  iconBg: string;        // icon tile background
  iconFg: string;        // icon tile foreground
  badgeBg: string;       // category-pill background
  badgeFg: string;       // category-pill foreground
  hoverBorder: string;   // border on hover
  ctaText: string;       // hover CTA color
  label: string;         // human-readable category label
};

function styleFor(category: string): CategoryStyle {
  switch (category) {
    case "compliance":
      return {
        stripe: "bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500",
        iconBg: "bg-emerald-50",
        iconFg: "text-emerald-700",
        badgeBg: "bg-emerald-50",
        badgeFg: "text-emerald-700",
        hoverBorder: "group-hover:border-emerald-300",
        ctaText: "text-emerald-700",
        label: "Compliance",
      };
    case "finance-ops":
      return {
        stripe: "bg-gradient-to-r from-[#0085CF] via-[#0095e0] to-cyan-400",
        iconBg: "bg-[#0085CF]/10",
        iconFg: "text-[#0085CF]",
        badgeBg: "bg-[#0085CF]/10",
        badgeFg: "text-[#0072b3]",
        hoverBorder: "group-hover:border-[#0085CF]/40",
        ctaText: "text-[#0085CF]",
        label: "Finance ops",
      };
    case "research":
      return {
        stripe: "bg-gradient-to-r from-violet-400 via-purple-500 to-fuchsia-500",
        iconBg: "bg-violet-50",
        iconFg: "text-violet-700",
        badgeBg: "bg-violet-50",
        badgeFg: "text-violet-700",
        hoverBorder: "group-hover:border-violet-300",
        ctaText: "text-violet-700",
        label: "Research",
      };
    default:
      return {
        stripe: "bg-gradient-to-r from-gray-300 via-gray-400 to-gray-500",
        iconBg: "bg-gray-100",
        iconFg: "text-gray-600",
        badgeBg: "bg-gray-100",
        badgeFg: "text-gray-700",
        hoverBorder: "group-hover:border-gray-300",
        ctaText: "text-gray-700",
        label: category,
      };
  }
}

export function TemplateCard({ template }: { template: TemplateCardData }) {
  const router = useRouter();
  const Icon = iconFor(template.iconName);
  const style = styleFor(template.category);

  const goToTemplate = () => {
    router.push(`/agents/new?templateSlug=${encodeURIComponent(template.slug)}`);
  };

  return (
    <div
      className={cn(
        "group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-200 ease-out",
        "hover:-translate-y-0.5 hover:shadow-lg",
        style.hoverBorder,
      )}
      role="button"
      tabIndex={0}
      onClick={goToTemplate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToTemplate();
        }
      }}
      aria-label={`Use template: ${template.name}`}
    >
      {/* Top accent stripe — category color */}
      <div className={cn("h-1 w-full shrink-0", style.stripe)} />

      <div className="flex flex-1 flex-col p-5">
        {/* Header — icon tile + name + category pill */}
        <div className="flex items-start gap-3">
          <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", style.iconBg)}>
            <Icon className={cn("size-5", style.iconFg)} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[15px] font-semibold leading-tight text-gray-900">
              {template.name}
            </h3>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                  style.badgeBg,
                  style.badgeFg,
                )}
              >
                {style.label}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                v{template.version}
              </span>
            </div>
          </div>
        </div>

        {/* Description — line-clamped to keep cards even-height */}
        <p className="mt-4 line-clamp-3 text-[13px] leading-relaxed text-gray-600">
          {template.description}
        </p>

        {/* Footer — reviewer hint + doc policy + hover CTA */}
        <div className="mt-auto pt-4">
          <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
            {template.reviewerRoleHint ? (
              <span
                className="inline-flex min-w-0 items-center gap-1 text-[11px] text-gray-500"
                title={`Reviewer: ${template.reviewerRoleHint}`}
              >
                <UserCheck className="size-3 shrink-0" />
                <span className="truncate">{template.reviewerRoleHint}</span>
              </span>
            ) : (
              <span />
            )}
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                template.docPolicy === "required"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-gray-50 text-gray-500",
              )}
              title={template.docPolicy === "required" ? "Documents required to run" : "Documents optional"}
            >
              <FileText className="size-2.5" />
              {template.docPolicy === "required" ? "Docs required" : "Docs optional"}
            </span>
          </div>

          {/* Hover-revealed CTA */}
          <div
            className={cn(
              "mt-2 flex items-center justify-end gap-1 text-[12px] font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100",
              style.ctaText,
            )}
          >
            Use template <ArrowRight className="size-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
}
