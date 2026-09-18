// components/store-builder/editors/audience-profile-editor.tsx
"use client";

import type { AudienceProfile } from "@/lib/store-builder/types";
import { BulletListEditor } from "./bullet-list-editor";

export function AudienceProfileEditor({ value, onChange }: { value: AudienceProfile; onChange: (v: AudienceProfile) => void }) {
  return (
    <div className="space-y-2">
      <input value={value.demographics} onChange={(e) => onChange({ ...value, demographics: e.target.value })} placeholder="Demographics" className="w-full rounded border border-gray-200 px-2 py-1 text-sm" />
      <div>
        <p className="text-xs text-gray-500 mb-1">Preferences</p>
        <BulletListEditor value={value.preferences} onChange={(preferences) => onChange({ ...value, preferences })} />
      </div>
      <textarea value={value.shoppingBehavior} onChange={(e) => onChange({ ...value, shoppingBehavior: e.target.value })} rows={2} placeholder="Shopping behavior" className="w-full rounded border border-gray-200 px-2 py-1 text-sm resize-none" />
    </div>
  );
}

export function AudienceProfileView({ value }: { value: AudienceProfile }) {
  return (
    <div className="text-sm text-gray-700 space-y-1">
      <p><span className="font-medium">Demographics:</span> {value.demographics}</p>
      <p><span className="font-medium">Preferences:</span> {value.preferences.join(" · ")}</p>
      <p><span className="font-medium">Behavior:</span> {value.shoppingBehavior}</p>
    </div>
  );
}
