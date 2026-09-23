"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SETTINGS_NAV } from "./settings-nav-items";

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings sections" className="flex flex-col gap-6">
      <Link
        href="/settings"
        className={cn(
          "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          pathname === "/settings"
            ? "bg-[#0085CF]/10 text-[#0085CF]"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
        )}
      >
        Overview
      </Link>

      {SETTINGS_NAV.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            {group.label}
          </p>
          {group.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-[#0085CF]/10 font-medium text-[#0085CF]"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                )}
              >
                <item.icon
                  className={cn(
                    "size-4 shrink-0",
                    active ? "text-[#0085CF]" : "text-gray-400 group-hover:text-gray-600",
                  )}
                />
                <span className="truncate">{item.title}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

// Small screens get the same destinations as a horizontal scroller — the rail
// would otherwise eat half the viewport.
export function SettingsNavMobile() {
  const pathname = usePathname();
  const flat = SETTINGS_NAV.flatMap((g) => g.items);

  return (
    <nav
      aria-label="Settings sections"
      className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-3 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <Link
        href="/settings"
        className={cn(
          "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
          pathname === "/settings"
            ? "border-[#0085CF]/30 bg-[#0085CF]/10 text-[#0085CF]"
            : "border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900",
        )}
      >
        Overview
      </Link>
      {flat.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "border-[#0085CF]/30 bg-[#0085CF]/10 text-[#0085CF]"
                : "border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900",
            )}
          >
            <item.icon className="size-3.5" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
