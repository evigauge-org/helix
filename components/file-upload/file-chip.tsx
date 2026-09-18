import { FileText, X } from "lucide-react";

function truncateName(name: string, max = 24): string {
  if (name.length <= max) return name;
  const ext = name.lastIndexOf(".");
  if (ext > 0 && name.length - ext <= 6) {
    const extension = name.slice(ext);
    return name.slice(0, max - extension.length - 3) + "..." + extension;
  }
  return name.slice(0, max - 3) + "...";
}

export function FileChip({ name, onRemove }: { name: string; onRemove?: () => void }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0085CF]/10 border border-[#0085CF]/15 px-2.5 py-1 text-[11px] text-[#0085CF] max-w-[200px]"
      title={name}
    >
      <FileText className="size-3 shrink-0" />
      <span className="truncate">{truncateName(name)}</span>
      {onRemove && (
        <button onClick={onRemove} className="hover:text-red-500 transition-colors cursor-pointer shrink-0">
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}
