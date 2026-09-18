"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, ShieldCheck, BarChart3, Microscope, LayoutGrid } from "lucide-react";
import { TemplateCard, type TemplateCardData } from "./template-card";

const CATEGORIES = ["all", "compliance", "finance-ops", "research"] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_META: Record<Category, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  "all": { label: "All", icon: LayoutGrid },
  "compliance": { label: "Compliance", icon: ShieldCheck },
  "finance-ops": { label: "Finance ops", icon: BarChart3 },
  "research": { label: "Research", icon: Microscope },
};

export function TemplateGallery() {
  const [templates, setTemplates] = useState<TemplateCardData[]>([]);
  const [filter, setFilter] = useState<Category>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/agents/templates");
      if (res.ok) {
        const { templates } = (await res.json()) as { templates: TemplateCardData[] };
        setTemplates(templates);
      }
      setLoading(false);
    })();
  }, []);

  const counts = useMemo(() => {
    const m: Record<Category, number> = { "all": templates.length, "compliance": 0, "finance-ops": 0, "research": 0 };
    for (const t of templates) {
      if (t.category in m) m[t.category as Category] += 1;
    }
    return m;
  }, [templates]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates
      .filter((t) => filter === "all" || t.category === filter)
      .filter((t) => {
        if (!q) return true;
        return (
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.slug.toLowerCase().includes(q)
        );
      });
  }, [templates, filter, query]);

  return (
    <div>
      {/* Toolbar — segmented category filter + search */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 p-1">
          {CATEGORIES.map((c) => {
            const meta = CATEGORY_META[c];
            const Icon = meta.icon;
            const active = filter === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setFilter(c)}
                className={
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors " +
                  (active
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700")
                }
              >
                <Icon className="size-3.5" />
                {meta.label}
                <span
                  className={
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold " +
                    (active ? "bg-gray-100 text-gray-600" : "bg-white text-gray-400")
                  }
                >
                  {counts[c]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search templates…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-full border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#0085CF]/50 focus:outline-none focus:ring-2 focus:ring-[#0085CF]/15"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 animate-pulse rounded-2xl border border-gray-100 bg-gray-50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 py-12 text-center">
          <p className="text-sm font-medium text-gray-700">No templates match.</p>
          <p className="mt-1 text-xs text-gray-500">
            {query ? "Try a different search term, or " : ""}clear the filter, or run{" "}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-700">
              bun run scripts/seed-templates.ts
            </code>{" "}
            to seed the catalog.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => (
            <TemplateCard key={t.slug} template={t} />
          ))}
        </div>
      )}
    </div>
  );
}
