import { SettingsNav, SettingsNavMobile } from "./settings-nav";

// The rail is its own full-height column pinned to the left edge with a hairline
// divider; the content sits in the remaining space with generous side padding.
// (Previously both lived inside one centred `max-w-6xl`, which left the rail
// floating in dead space and cramped against the content.)
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full w-full">
      <aside className="hidden w-60 shrink-0 border-r border-[#0085CF]/10 bg-gray-50/40 lg:block">
        <div className="sticky top-0 px-5 py-8">
          <p className="px-3 pb-5 text-base font-semibold text-gray-900">Settings</p>
          <SettingsNav />
        </div>
      </aside>

      <div className="min-w-0 flex-1 px-6 py-8 lg:px-12 xl:px-16">
        <SettingsNavMobile />
        <div className="mx-auto w-full max-w-4xl">{children}</div>
      </div>
    </div>
  );
}
