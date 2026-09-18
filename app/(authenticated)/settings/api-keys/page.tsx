"use client";

import { useEffect, useState } from "react";
import { Copy, Key, Loader2, Plus, ShieldAlert, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AEP_SCOPES, AEP_WILDCARD, SCOPE_GROUPS, type AepScope } from "@/lib/aep/authz/scopes";

type ApiKeyRow = {
  id: string;
  name: string | null;
  start: string | null;
  prefix: string | null;
  createdAt: string;
  lastRequest: string | null;
  expiresAt: string | null;
  enabled: boolean;
  permissions: { aep?: string[] } | null;
};

const DEFAULT_SCOPES: AepScope[] = ["agent.read", "run.create", "run.read", "stream.subscribe"];

// Pin checkbox/switch colors so they're visible on the dialog's white bg.
// Default shadcn uses theme-aware tokens which fade out in dark themes.
const CHECKBOX_PIN =
  "border-gray-300 data-checked:bg-[#0085CF] data-checked:border-[#0085CF] data-checked:text-white";
const SWITCH_PIN =
  "data-checked:bg-[#0085CF] data-unchecked:bg-gray-200";

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [grantAll, setGrantAll] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(() => new Set(DEFAULT_SCOPES));
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [revealKey, setRevealKey] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/api-key/list", { credentials: "include" });
      const data = await res.json();
      const list = data?.apiKeys ?? data?.keys ?? (Array.isArray(data) ? data : []);
      setKeys(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetCreateForm = () => {
    setName("");
    setCreateError(null);
    setGrantAll(false);
    setSelectedScopes(new Set(DEFAULT_SCOPES));
  };

  const toggleScope = (scope: AepScope, on: boolean) => {
    setSelectedScopes((prev) => {
      const next = new Set(prev);
      if (on) next.add(scope);
      else next.delete(scope);
      return next;
    });
  };

  const toggleGroup = (groupScopes: AepScope[], on: boolean) => {
    setSelectedScopes((prev) => {
      const next = new Set(prev);
      for (const s of groupScopes) {
        if (on) next.add(s);
        else next.delete(s);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setCreateError("Name is required");
      return;
    }
    if (!grantAll && selectedScopes.size === 0) {
      setCreateError("Select at least one scope or enable Grant all access");
      return;
    }
    const aepScopes = grantAll ? [AEP_WILDCARD] : Array.from(selectedScopes).filter((s): s is AepScope => AEP_SCOPES.includes(s as AepScope));
    setCreateBusy(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/me/api-keys", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          scopes: aepScopes,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setCreateError(err?.message ?? `Failed (${res.status})`);
        return;
      }
      const created = await res.json();
      const raw = created?.key;
      if (typeof raw !== "string") {
        console.error("api-key/create unexpected response:", created);
        setCreateError(
          `Server did not return a key value. Response keys: ${Object.keys(created ?? {}).join(", ") || "(empty)"}`,
        );
        return;
      }
      setCreateOpen(false);
      resetCreateForm();
      setRevealKey(raw);
      await load();
    } finally {
      setCreateBusy(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeId) return;
    setRevokeBusy(true);
    try {
      await fetch("/api/auth/api-key/delete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId: revokeId }),
      });
      setRevokeId(null);
      await load();
    } finally {
      setRevokeBusy(false);
    }
  };

  const copyToClipboard = (value: string) => {
    void navigator.clipboard.writeText(value);
  };

  const renderScopeBadges = (perms: ApiKeyRow["permissions"]) => {
    const aepScopes = perms?.aep ?? [];
    if (aepScopes.length === 0) {
      return <Badge variant="outline" className="text-xs text-gray-500">no scopes</Badge>;
    }
    if (aepScopes.includes(AEP_WILDCARD)) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs cursor-help">
                <ShieldAlert className="size-3" /> All access
              </Badge>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              align="start"
              className="block max-w-xs whitespace-normal bg-gray-900 px-3 py-2 text-left text-xs leading-relaxed text-white"
            >
              This key has the <code className="rounded bg-white/10 px-1 font-mono text-[11px] text-amber-200">aep:*</code> wildcard — full access to your account. If it leaks, anyone with the key can do anything you can. Prefer narrow scopes for new keys.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return aepScopes.map((s) => (
      <Badge key={s} variant="secondary" className="text-xs font-mono">
        {s}
      </Badge>
    ));
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">API Keys</h1>
          <p className="mt-1 text-sm text-gray-500">
            Programmatic access for the AEP SDK, MCP servers, and third-party agents. Use as{" "}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">Authorization: Bearer hlx_…</code>.
            Each key carries a set of scopes that limit what it can do.
          </p>
        </div>
        <Button
          onClick={() => {
            resetCreateForm();
            setCreateOpen(true);
          }}
          className="bg-[#0085CF] text-white hover:bg-[#0085CF]/90"
        >
          <Plus className="size-4" />
          Create API Key
        </Button>
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-gray-500">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <Key className="size-8 text-gray-300" />
            <p className="text-sm text-gray-500">No API keys yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {keys.map((k) => (
              <div key={k.id} className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-gray-900">{k.name ?? "Unnamed key"}</p>
                    {!k.enabled && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">disabled</span>
                    )}
                  </div>
                  <p className="mt-1 font-mono text-xs text-gray-500">
                    {k.start ? `${k.start}…` : k.prefix ?? "hlx_…"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {renderScopeBadges(k.permissions)}
                  </div>
                  <p className="mt-2 text-xs text-gray-400">
                    Created {new Date(k.createdAt).toLocaleDateString()}
                    {k.lastRequest && ` · Last used ${new Date(k.lastRequest).toLocaleDateString()}`}
                    {k.expiresAt && ` · Expires ${new Date(k.expiresAt).toLocaleDateString()}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRevokeId(k.id)}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="size-4" />
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-white text-gray-900 sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Create API Key</DialogTitle>
            <DialogDescription className="text-gray-500">
              Give your key a name and pick the scopes it should have. The key value will only be shown once after creation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                placeholder="e.g. Production smoke test"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={createBusy}
                autoFocus
              />
            </div>

            <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <Label htmlFor="grant-all" className="font-medium text-amber-900">Grant all access (aep:*)</Label>
                  <p className="mt-1 text-xs text-amber-800/80">
                    Off by default. When on, this key can do anything you can. Use only for personal scripts on machines you control.
                  </p>
                </div>
                <Switch id="grant-all" checked={grantAll} onCheckedChange={setGrantAll} disabled={createBusy} className={SWITCH_PIN} />
              </div>
            </div>

            {!grantAll && (
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-900">Scopes</Label>
                <div className="space-y-3">
                  {SCOPE_GROUPS.map((group) => {
                    const allOn = group.scopes.every((s) => selectedScopes.has(s));
                    const someOn = group.scopes.some((s) => selectedScopes.has(s));
                    return (
                      <div key={group.label} className="rounded-md border border-gray-200 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={allOn ? true : someOn ? "indeterminate" : false}
                                onCheckedChange={(v) => toggleGroup(group.scopes, v === true)}
                                disabled={createBusy}
                                className={CHECKBOX_PIN}
                              />
                              <span className="font-medium text-gray-900">{group.label}</span>
                            </div>
                            <p className="ml-6 mt-1 text-xs text-gray-500">{group.description}</p>
                          </div>
                        </div>
                        <div className="ml-6 mt-2 flex flex-wrap gap-x-4 gap-y-2">
                          {group.scopes.map((s) => (
                            <label key={s} className="flex items-center gap-2 text-xs text-gray-700">
                              <Checkbox
                                checked={selectedScopes.has(s)}
                                onCheckedChange={(v) => toggleScope(s, v === true)}
                                disabled={createBusy}
                                className={CHECKBOX_PIN}
                              />
                              <code className="font-mono">{s}</code>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {createError && <p className="text-xs text-red-600">{createError}</p>}
          </div>

          <DialogFooter className="bg-gray-50 border-gray-200">
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={createBusy}
              className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createBusy}
              className="bg-[#0085CF] text-white hover:bg-[#0085CF]/90"
            >
              {createBusy && <Loader2 className="size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revealKey !== null} onOpenChange={(open) => !open && setRevealKey(null)}>
        <DialogContent className="bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Save your API key</DialogTitle>
            <DialogDescription className="text-gray-500">
              This is the only time the full key will be shown. Copy it now and store it somewhere safe — Helix
              cannot recover it.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
            <code className="flex-1 break-all font-mono text-xs text-gray-900">{revealKey}</code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => revealKey && copyToClipboard(revealKey)}
              className="shrink-0 border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              <Copy className="size-3" />
              Copy
            </Button>
          </div>
          <DialogFooter className="bg-gray-50 border-gray-200">
            <Button onClick={() => setRevealKey(null)} className="bg-[#0085CF] text-white hover:bg-[#0085CF]/90">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={revokeId !== null} onOpenChange={(open) => !open && setRevokeId(null)}>
        <AlertDialogContent className="bg-white text-gray-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900">Revoke this API key?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500">
              Any service using this key will lose access immediately. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="bg-gray-50 border-gray-200">
            <AlertDialogCancel disabled={revokeBusy} className="bg-white text-gray-900 border-gray-200 hover:bg-gray-50">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={revokeBusy}
              className="bg-red-600 hover:bg-red-700"
            >
              {revokeBusy && <Loader2 className="size-4 animate-spin" />}
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
