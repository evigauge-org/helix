"use client";

import { Check, FileQuestion } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChecklistItem = {
  label: string;
  hint?: string;
  exampleFormats?: string[];
};

export type AttachedFile = {
  id: string;
  filename: string;
  status: "uploading" | "processing" | "ready" | "failed";
};

// Best-effort substring matcher: lowercase the filename, strip the extension,
// and check whether any keyword (>=3 chars) from the checklist label appears
// in the cleaned filename. Returns the index of the first matching checklist
// item, or null if no match. Users can override via the role-dropdown UI on
// the file (v1.1).
export function matchFileToChecklist(filename: string, checklist: ChecklistItem[]): number | null {
  const lower = filename.toLowerCase().replace(/\.[a-z0-9]+$/, "");
  for (let i = 0; i < checklist.length; i++) {
    const keywords = checklist[i].label
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-z0-9]/g, ""))
      .filter((w) => w.length >= 3);
    if (keywords.some((k) => lower.includes(k))) {
      return i;
    }
  }
  return null;
}

export function DocChecklist({
  policy,
  items,
  files,
}: {
  policy: "required" | "optional";
  items: ChecklistItem[];
  files: AttachedFile[];
}) {
  const satisfied: boolean[] = items.map((_, i) =>
    files.some(
      (f) => f.status === "ready" && matchFileToChecklist(f.filename, items) === i,
    ),
  );

  const headerClass =
    policy === "required"
      ? "bg-red-50 border-red-200 text-red-700"
      : "bg-amber-50 border-amber-200 text-amber-800";
  const headerTitle =
    policy === "required"
      ? "Required documents — Run is disabled until at least one of each is uploaded"
      : "Recommended documents — runs without these but quality improves with them";

  return (
    <div className="rounded-md border bg-white">
      <div className={cn("rounded-t-md border-b px-3 py-1.5 text-xs font-medium", headerClass)}>
        {headerTitle}
      </div>
      <ul className="px-3 py-2 space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                "inline-flex size-5 items-center justify-center rounded-full border",
                satisfied[i]
                  ? "bg-emerald-500 border-emerald-600 text-white"
                  : "bg-white border-gray-300 text-gray-400",
              )}
              aria-hidden
            >
              {satisfied[i] ? <Check className="size-3" /> : <FileQuestion className="size-3" />}
            </span>
            <span className={cn(satisfied[i] ? "text-gray-800" : "text-gray-600")}>
              {it.label}
            </span>
            {it.exampleFormats?.length ? (
              <span className="text-xs text-gray-400">({it.exampleFormats.join(", ")})</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function checklistSatisfied(
  items: ChecklistItem[],
  files: AttachedFile[],
): boolean {
  return items.every((_, i) =>
    files.some(
      (f) => f.status === "ready" && matchFileToChecklist(f.filename, items) === i,
    ),
  );
}
