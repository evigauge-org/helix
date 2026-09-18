"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Check, Loader2, Plug, Plus, Power, Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

type Server = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  hasBearer: boolean;
  customHeaderCount: number;
  lastConnectedAt: string | null;
  lastError: string | null;
  createdAt: string;
};

const SWITCH_PIN = "data-checked:bg-[#0085CF] data-unchecked:bg-gray-200";

function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}${u.pathname.length > 1 ? "/…" : ""}`;
  } catch {
    return url;
  }
}

export default function McpServersPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = use(params);

  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [bearer, setBearer] = useState("");

  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/me/agents/${agentId}/mcp-servers`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setLoadError(err?.error ?? `Load failed (${res.status})`);
        return;
      }
      setServers(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const resetAddForm = () => {
    setName("");
    setUrl("");
    setBearer("");
    setAddError(null);
  };

  const handleAdd = async () => {
    if (!name.trim()) return setAddError("Name is required");
    if (!url.trim()) return setAddError("URL is required");
    setAddBusy(true);
    setAddError(null);
    try {
      const res = await fetch(`/api/me/agents/${agentId}/mcp-servers`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          url: url.trim(),
          auth: bearer.trim() ? { bearer: bearer.trim() } : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAddError(err?.error ?? `Add failed (${res.status})`);
        return;
      }
      setAddOpen(false);
      resetAddForm();
      await load();
    } finally {
      setAddBusy(false);
    }
  };

  const toggleEnabled = async (server: Server) => {
    const next = !server.enabled;
    // Optimistic
    setServers((prev) => prev.map((s) => (s.id === server.id ? { ...s, enabled: next } : s)));
    const res = await fetch(`/api/me/agents/${agentId}/mcp-servers/${server.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    if (!res.ok) {
      // Revert on failure
      setServers((prev) => prev.map((s) => (s.id === server.id ? { ...s, enabled: server.enabled } : s)));
    }
  };

  const handleRemove = async () => {
    if (!revokeId) return;
    setRevokeBusy(true);
    try {
      await fetch(`/api/me/agents/${agentId}/mcp-servers/${revokeId}`, {
        method: "DELETE",
        credentials: "include",
      });
      setRevokeId(null);
      await load();
    } finally {
      setRevokeBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <Link
        href={`/agents?selected=${agentId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft className="size-4" /> Back to agent
      </Link>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">External MCP Servers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Attach external Model Context Protocol servers to expand this agent's tools. Tools from each server
            appear under <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">mcp.&lt;server&gt;.&lt;tool&gt;</code>{" "}
            in the agent's effective toolset.
          </p>
        </div>
        <Button
          onClick={() => {
            resetAddForm();
            setAddOpen(true);
          }}
          className="bg-[#0085CF] text-white hover:bg-[#0085CF]/90"
        >
          <Plus className="size-4" />
          Add Server
        </Button>
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-gray-500">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : loadError ? (
          <div className="p-6 text-center text-sm text-red-600">{loadError}</div>
        ) : servers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <Plug className="size-8 text-gray-300" />
            <p className="text-sm text-gray-500">
              No external MCP servers attached. Add one to expand the agent's available tools.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {servers.map((s) => (
              <div key={s.id} className="flex items-start gap-4 p-4">
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                    s.lastError
                      ? "bg-red-100"
                      : s.lastConnectedAt
                        ? "bg-emerald-100"
                        : "bg-[#0085CF]/10"
                  }`}
                >
                  {s.lastError ? (
                    <AlertCircle className="size-5 text-red-600" />
                  ) : s.lastConnectedAt ? (
                    <Check className="size-5 text-emerald-600" />
                  ) : (
                    <Power className="size-5 text-[#0085CF]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-gray-900">{s.name}</p>
                    {!s.enabled && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">disabled</span>
                    )}
                  </div>
                  <p className="mt-1 truncate font-mono text-xs text-gray-500" title={s.url}>
                    {maskUrl(s.url)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {s.hasBearer && (
                      <Badge variant="secondary" className="text-xs">bearer auth</Badge>
                    )}
                    {s.customHeaderCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {s.customHeaderCount} custom header{s.customHeaderCount === 1 ? "" : "s"}
                      </Badge>
                    )}
                    {!s.hasBearer && s.customHeaderCount === 0 && (
                      <Badge variant="outline" className="text-xs text-gray-500">no auth</Badge>
                    )}
                  </div>
                  {s.lastError && (
                    <p className="mt-2 text-xs text-red-600" title={s.lastError}>
                      Last error: {s.lastError.length > 80 ? `${s.lastError.slice(0, 80)}…` : s.lastError}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-gray-400">
                    Added {new Date(s.createdAt).toLocaleDateString()}
                    {s.lastConnectedAt && ` · Last connected ${new Date(s.lastConnectedAt).toLocaleString()}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Switch
                    checked={s.enabled}
                    onCheckedChange={() => toggleEnabled(s)}
                    className={SWITCH_PIN}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRevokeId(s.id)}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-white text-gray-900 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Add MCP Server</DialogTitle>
            <DialogDescription className="text-gray-500">
              Attach an external MCP server to this agent. Its tools become callable as{" "}
              <code className="rounded bg-gray-100 px-1 text-xs">mcp.&lt;name&gt;.&lt;tool&gt;</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="server-name">Name</Label>
              <Input
                id="server-name"
                placeholder="e.g. github"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={addBusy}
                autoFocus
              />
              <p className="text-xs text-gray-500">
                Used as the namespace prefix for this server's tools. Letters, digits, dashes only.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="server-url">URL</Label>
              <Input
                id="server-url"
                placeholder="https://mcp.example.com/v1"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={addBusy}
              />
              <p className="text-xs text-gray-500">
                Must be a public https URL. Internal IPs (10.x, 192.168.x, localhost, cloud-metadata) are blocked.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="server-bearer">Bearer token (optional)</Label>
              <Input
                id="server-bearer"
                type="password"
                placeholder="(leave blank for unauthenticated)"
                value={bearer}
                onChange={(e) => setBearer(e.target.value)}
                disabled={addBusy}
              />
            </div>
            {addError && <p className="text-xs text-red-600">{addError}</p>}
          </div>
          <DialogFooter className="bg-gray-50 border-gray-200">
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              disabled={addBusy}
              className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={addBusy}
              className="bg-[#0085CF] text-white hover:bg-[#0085CF]/90"
            >
              {addBusy && <Loader2 className="size-4 animate-spin" />}
              Add Server
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={revokeId !== null} onOpenChange={(open) => !open && setRevokeId(null)}>
        <AlertDialogContent className="bg-white text-gray-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900">Remove this MCP server?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500">
              The agent will no longer have access to this server's tools. You can re-add the server any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="bg-gray-50 border-gray-200">
            <AlertDialogCancel
              disabled={revokeBusy}
              className="bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={revokeBusy}
              className="bg-red-600 hover:bg-red-700"
            >
              {revokeBusy && <Loader2 className="size-4 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
