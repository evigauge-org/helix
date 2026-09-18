"use client";

import { Palette, Image as ImageIcon } from "lucide-react";
import type { BrandingOutput, BrandVoice, BrandNameOption } from "@/lib/store-builder/types";
import { EditableSection } from "./editable-section";
import { useSectionApi } from "./use-section-api";
import { NameOptionsEditor, NameOptionsView } from "./editors/name-options-editor";
import { ColorPaletteEditor, ColorPaletteView } from "./editors/color-palette-editor";
import { BulletListEditor } from "./editors/bullet-list-editor";

interface Props {
  projectId: string;
  stageId: string;
  branding: BrandingOutput;
  onSectionUpdated: (updated: BrandingOutput) => void;
}

type Typography = BrandingOutput["typography"];

function TypographyEditor({ value, onChange }: { value: Typography; onChange: (v: Typography) => void }) {
  return (
    <div className="space-y-2">
      <input value={value.heading} onChange={(e) => onChange({ ...value, heading: e.target.value })} placeholder="Heading font (Google Fonts name)" className="w-full rounded border border-gray-200 px-2 py-1 text-sm" />
      <input value={value.body}    onChange={(e) => onChange({ ...value, body: e.target.value })}    placeholder="Body font (Google Fonts name)"    className="w-full rounded border border-gray-200 px-2 py-1 text-sm" />
      <textarea value={value.reasoning} onChange={(e) => onChange({ ...value, reasoning: e.target.value })} rows={2} placeholder="Why this pairing..." className="w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 resize-none" />
    </div>
  );
}

function TypographyView({ value }: { value: Typography }) {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
      <p className="text-lg font-bold text-gray-800">{value.heading}</p>
      <p className="text-sm text-gray-600">{value.body}</p>
      <p className="text-xs text-gray-500 mt-1">{value.reasoning}</p>
    </div>
  );
}

function BrandVoiceEditor({ value, onChange }: { value: BrandVoice; onChange: (v: BrandVoice) => void }) {
  return (
    <div className="space-y-2">
      <input value={value.tone} onChange={(e) => onChange({ ...value, tone: e.target.value })} placeholder="Tone" className="w-full rounded border border-gray-200 px-2 py-1 text-sm" />
      <div>
        <p className="text-xs text-gray-500 mb-1">Dos</p>
        <BulletListEditor value={value.dos}   onChange={(dos)   => onChange({ ...value, dos })}   placeholder="Do" />
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">Don&apos;ts</p>
        <BulletListEditor value={value.donts} onChange={(donts) => onChange({ ...value, donts })} placeholder="Don't" />
      </div>
      <textarea value={value.sampleProductDesc} onChange={(e) => onChange({ ...value, sampleProductDesc: e.target.value })} rows={2} placeholder="Sample product description" className="w-full rounded border border-gray-200 px-2 py-1 text-sm resize-none" />
      <textarea value={value.sampleCaption}     onChange={(e) => onChange({ ...value, sampleCaption: e.target.value })}     rows={2} placeholder="Sample caption"             className="w-full rounded border border-gray-200 px-2 py-1 text-sm resize-none" />
    </div>
  );
}

function BrandVoiceView({ value }: { value: BrandVoice }) {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 space-y-2 text-sm">
      <p><span className="font-medium text-gray-800">Tone:</span> <span className="text-gray-600">{value.tone}</span></p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="font-medium text-emerald-700 text-xs mb-1">Do</p>
          <ul className="text-xs text-gray-600 space-y-0.5">{value.dos.map((d, i) => <li key={i}>✓ {d}</li>)}</ul>
        </div>
        <div>
          <p className="font-medium text-red-700 text-xs mb-1">Don&apos;t</p>
          <ul className="text-xs text-gray-600 space-y-0.5">{value.donts.map((d, i) => <li key={i}>✗ {d}</li>)}</ul>
        </div>
      </div>
      <div className="rounded-md bg-white border border-gray-200 p-2 text-xs italic text-gray-600">
        &ldquo;{value.sampleProductDesc}&rdquo;
      </div>
    </div>
  );
}

export function BrandCard({ projectId, stageId, branding, onSectionUpdated }: Props) {
  const api = useSectionApi<BrandingOutput>(projectId, stageId, 3, onSectionUpdated);
  const s = branding.sections;

  return (
    <div className="my-4 rounded-xl border border-[#0085CF]/15 bg-white p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-violet-100">
          <Palette className="size-5 text-violet-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-800">Brand Identity</p>
          <p className="text-xs text-gray-500">Selected: {branding.selectedName} · {branding.logoUrls.length} logos</p>
        </div>
      </div>

      <EditableSection<BrandNameOption[]>
        section={s.nameOptions}
        label="Name Options"
        renderView={(c) => <NameOptionsView value={c} />}
        renderEditor={(c, onChange) => <NameOptionsEditor value={c} onChange={onChange} />}
        onRegenerate={(e) => api.regenerate("nameOptions", e)}
        onSaveAsIs={(c) => api.saveAsIs("nameOptions", c)}
        onApprove={(vid) => api.approve("nameOptions", vid)}
      />

      <EditableSection
        section={s.colors}
        label="Color Palette"
        renderView={(c) => <ColorPaletteView value={c} />}
        renderEditor={(c, onChange) => <ColorPaletteEditor value={c} onChange={onChange} />}
        onRegenerate={(e) => api.regenerate("colors", e)}
        onSaveAsIs={(c) => api.saveAsIs("colors", c)}
        onApprove={(vid) => api.approve("colors", vid)}
      />

      <EditableSection
        section={s.typography}
        label="Typography"
        renderView={(c) => <TypographyView value={c} />}
        renderEditor={(c, onChange) => <TypographyEditor value={c} onChange={onChange} />}
        onRegenerate={(e) => api.regenerate("typography", e)}
        onSaveAsIs={(c) => api.saveAsIs("typography", c)}
        onApprove={(vid) => api.approve("typography", vid)}
      />

      <EditableSection
        section={s.brandVoice}
        label="Brand Voice"
        renderView={(c) => <BrandVoiceView value={c} />}
        renderEditor={(c, onChange) => <BrandVoiceEditor value={c} onChange={onChange} />}
        onRegenerate={(e) => api.regenerate("brandVoice", e)}
        onSaveAsIs={(c) => api.saveAsIs("brandVoice", c)}
        onApprove={(vid) => api.approve("brandVoice", vid)}
      />

      {branding.logoUrls.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 flex items-center gap-1">
            <ImageIcon className="size-3" /> Logo Concepts
          </p>
          <div className="grid grid-cols-3 gap-2">
            {branding.logoUrls.map((url, i) => (
              <div key={i} className="rounded-lg border border-gray-200 bg-white p-2 flex items-center justify-center aspect-square overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Logo ${i + 1}`} className="max-w-full max-h-full object-contain" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
