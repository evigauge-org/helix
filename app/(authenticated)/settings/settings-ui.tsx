import { cn } from "@/lib/utils";

/** Page title + one-line intent. Every settings page opens with exactly this. */
export function SettingsHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4 border-b border-[#0085CF]/10 pb-5">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** A titled group of related controls. */
export function SettingsCard({
  title,
  description,
  footer,
  className,
  children,
}: {
  title: string;
  description?: string;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border border-[#0085CF]/10 bg-card shadow-sm", className)}>
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-gray-500">{description}</p> : null}
      </div>
      <div className="px-5 py-4">{children}</div>
      {footer ? (
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50/60 px-5 py-3">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

/** Label/description on the left, a control on the right. */
export function SettingRow({
  label,
  description,
  htmlFor,
  control,
  className,
}: {
  label: string;
  description?: string;
  htmlFor?: string;
  control: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-6 py-3", className)}>
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-900">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-sm text-gray-500">{description}</p> : null}
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  );
}
