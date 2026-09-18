"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Plug, Gem, ShieldCheck, KeyRound, AlertCircle } from "lucide-react";

type Kind = "openai_compat" | "anthropic" | "gemini";

interface ExistingRow {
  id: string;
  name: string;
  kind: string;
  base_url: string | null;
  api_key_hint: string;
  default_model: string | null;
}

const KINDS: {
  value: Kind;
  label: string;
  blurb: string;
  icon: React.ComponentType<{ className?: string }>;
  exampleModel: string;
}[] = [
  {
    value: "anthropic",
    label: "Anthropic",
    blurb: "Direct Claude API",
    icon: Sparkles,
    exampleModel: "claude-haiku-4.5",
  },
  {
    value: "openai_compat",
    label: "OpenAI-compatible",
    blurb: "OpenAI · OpenRouter · Perplexity · Grok · custom-hosted",
    icon: Plug,
    exampleModel: "gpt-4o-mini",
  },
  {
    value: "gemini",
    label: "Google Gemini",
    blurb: "Direct Gemini API",
    icon: Gem,
    exampleModel: "gemini-2.0-flash",
  },
];

const EXAMPLE_BASE_URLS = [
  "https://api.openai.com/v1",
  "https://openrouter.ai/api/v1",
  "https://api.perplexity.ai",
  "https://api.x.ai/v1",
];

export function ProviderFormDialog({
  mode,
  existing,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  existing?: ExistingRow;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [kind, setKind] = useState<Kind>((existing?.kind as Kind) ?? "anthropic");
  const [baseUrl, setBaseUrl] = useState(existing?.base_url ?? "");
  const [apiKey, setApiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState(existing?.default_model ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedKind = KINDS.find((k) => k.value === kind)!;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        base_url: baseUrl.trim() || null,
        default_model: defaultModel.trim() || null,
      };
      if (apiKey.length > 0) body.api_key = apiKey;
      if (mode === "create") body.kind = kind;

      const url = mode === "create" ? "/api/me/llm-providers" : `/api/me/llm-providers/${existing!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `HTTP ${r.status}`);
        return;
      }
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="bg-white text-gray-900 w-[calc(100%-1.5rem)] sm:max-w-lg max-h-[90dvh] p-0 gap-0 overflow-hidden flex flex-col"
      >
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b border-gray-100">
          <DialogTitle className="text-xl font-semibold text-gray-900">
            {mode === "create" ? "Add LLM provider" : `Edit “${existing?.name}”`}
          </DialogTitle>
          <DialogDescription className="text-gray-600 flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-green-600" />
            <span>Encrypted at rest with AES-256-GCM</span>
          </DialogDescription>
        </DialogHeader>

        <form id="provider-form" onSubmit={onSubmit} className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="prov-name" className="text-sm font-medium text-gray-800">
              Name <span className="text-red-600" aria-hidden="true">*</span>
            </Label>
            <Input
              id="prov-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Anthropic Prod"
              className="border-gray-300 bg-white text-gray-900 h-10 focus-visible:ring-[#0085CF]/40 focus-visible:border-[#0085CF]"
              required
              aria-required="true"
              aria-describedby="prov-name-help"
              autoFocus={mode === "create"}
            />
            <p id="prov-name-help" className="text-xs text-gray-500">A short label to identify this credential. Names must be unique within your account.</p>
          </div>

          <div className="space-y-2">
            <Label id="prov-kind-label" className="text-sm font-medium text-gray-800">
              Provider <span className="text-red-600" aria-hidden="true">*</span>
              {mode === "edit" && <span className="ml-1 text-xs font-normal text-gray-500">(locked after create)</span>}
            </Label>
            <div
              role="radiogroup"
              aria-labelledby="prov-kind-label"
              className="grid grid-cols-1 sm:grid-cols-3 gap-2"
            >
              {KINDS.map((k) => {
                const Icon = k.icon;
                const selected = kind === k.value;
                const disabled = mode === "edit";
                return (
                  <button
                    key={k.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-disabled={disabled}
                    disabled={disabled}
                    onClick={() => setKind(k.value)}
                    className={[
                      "relative flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0085CF]/40 focus-visible:ring-offset-1",
                      selected
                        ? "border-[#0085CF] bg-[#0085CF]/5 ring-1 ring-[#0085CF]/30"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50",
                      disabled && !selected ? "opacity-40 cursor-not-allowed hover:bg-white hover:border-gray-200" : "",
                      disabled && selected ? "cursor-default" : "",
                    ].join(" ")}
                  >
                    <div className={[
                      "flex size-7 items-center justify-center rounded-md",
                      selected ? "bg-[#0085CF]/10" : "bg-gray-100",
                    ].join(" ")}>
                      <Icon className={["size-4", selected ? "text-[#0085CF]" : "text-gray-600"].join(" ")} />
                    </div>
                    <div className="text-sm font-medium leading-tight text-gray-900">{k.label}</div>
                    <div className="text-[10.5px] leading-tight text-gray-500">{k.blurb}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {kind === "openai_compat" && (
            <div className="space-y-1.5">
              <Label htmlFor="prov-base-url" className="text-sm font-medium text-gray-800">
                Base URL <span className="text-red-600" aria-hidden="true">*</span>
              </Label>
              <Input
                id="prov-base-url"
                type="url"
                inputMode="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="border-gray-300 bg-white text-gray-900 font-mono text-xs h-10 focus-visible:ring-[#0085CF]/40 focus-visible:border-[#0085CF]"
                required={kind === "openai_compat"}
                aria-required={kind === "openai_compat"}
                aria-describedby="prov-base-url-help"
                autoComplete="off"
              />
              <div id="prov-base-url-help" className="space-y-1">
                <p className="text-xs text-gray-500">Quick fill:</p>
                <div className="flex flex-wrap gap-1">
                  {EXAMPLE_BASE_URLS.map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setBaseUrl(u)}
                      aria-label={`Use base URL ${u}`}
                      className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10.5px] font-mono text-gray-600 transition hover:border-[#0085CF]/40 hover:bg-[#0085CF]/5 hover:text-[#0085CF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0085CF]/40"
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="prov-key" className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                <KeyRound className="size-3.5 text-gray-500" />
                API key {mode === "create" && <span className="text-red-600" aria-hidden="true">*</span>}
              </Label>
              {mode === "edit" && (
                <span className="text-[11px] text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded truncate max-w-[60%]">
                  current: {existing?.api_key_hint}
                </span>
              )}
            </div>
            <Input
              id="prov-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={mode === "edit" ? "Leave blank to keep current key" : "sk-ant-… / sk-… / your-key"}
              className="border-gray-300 bg-white text-gray-900 font-mono h-10 focus-visible:ring-[#0085CF]/40 focus-visible:border-[#0085CF]"
              required={mode === "create"}
              aria-required={mode === "create"}
              aria-describedby="prov-key-help"
              autoComplete="off"
              spellCheck={false}
            />
            <p id="prov-key-help" className="text-xs text-gray-500">
              {mode === "create"
                ? "Stored server-side, encrypted, never returned via API."
                : "Replacing the key will reset the test status."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prov-default-model" className="text-sm font-medium text-gray-800">
              Default model <span className="ml-1 text-xs font-normal text-gray-500">(optional)</span>
            </Label>
            <Input
              id="prov-default-model"
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              placeholder={`e.g. ${selectedKind.exampleModel}`}
              className="border-gray-300 bg-white text-gray-900 h-10 focus-visible:ring-[#0085CF]/40 focus-visible:border-[#0085CF]"
              aria-describedby="prov-default-model-help"
              autoComplete="off"
              spellCheck={false}
            />
            <p id="prov-default-model-help" className="text-xs text-gray-500">
              Used when an agent attaches this provider without specifying a model.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span className="break-words">{error}</span>
            </div>
          )}
        </form>

        <DialogFooter className="shrink-0 mx-0 mb-0 bg-gray-50 border-t border-gray-200 px-6 py-3 rounded-b-xl">
          <Button
            type="button"
            variant="outline"
            className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="provider-form"
            className="bg-[#0085CF] text-white hover:bg-[#0072B0] min-w-[80px]"
            disabled={saving}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : mode === "create" ? "Add provider" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
