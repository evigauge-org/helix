import { SettingsOverview } from "./overview-client";

// The overview is a dashboard, not a link menu — the rail in layout.tsx is the
// navigation. It answers "what is my account doing right now" in one screen,
// with the two controls people actually come here to flip (memory + which
// events notify them) inline rather than a click away.
export default function SettingsPage() {
  return <SettingsOverview />;
}
