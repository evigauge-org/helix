"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Loader2, Plus, CheckCircle2, XCircle, CircleDashed } from "lucide-react";
import { ProviderFormDialog } from "./provider-form-dialog";

interface ProviderRow {
  id: string;
  name: string;
  kind: string;
  base_url: string | null;
  api_key_hint: string;
  default_model: string | null;
  last_tested_at: string | null;
  last_test_status: string | null;
  created_at: string;
  updated_at: string;
  agent_count: number;
}

export function ProvidersTable({ initial }: { initial: ProviderRow[] }) {
  const [rows, setRows] = useState<ProviderRow[]>(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<ProviderRow | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProviderRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const refresh = async () => {
    const r = await fetch("/api/me/llm-providers");
    if (!r.ok) return;
    const data = (await r.json()) as { providers: ProviderRow[] };
    // server page already includes agent_count; re-fetch via separate call OR keep cached counts.
    // For simplicity here, only update fields that change from the API.
    setRows((prev) =>
      data.providers.map((p) => ({
        ...p,
        agent_count: prev.find((x) => x.id === p.id)?.agent_count ?? 0,
      })),
    );
  };

  const onTest = async (id: string) => {
    setTesting(id);
    try {
      await fetch(`/api/me/llm-providers/${id}/test`, { method: "POST" });
      await refresh();
    } finally {
      setTesting(null);
    }
  };

  const onDelete = async (row: ProviderRow) => {
    const r = await fetch(`/api/me/llm-providers/${row.id}`, { method: "DELETE" });
    if (r.status === 204) {
      setRows((prev) => prev.filter((x) => x.id !== row.id));
      setConfirmDelete(null);
      return;
    }
    if (r.status === 409) {
      const data = (await r.json()) as { agent_count?: number };
      setDeleteError(`Used by ${data.agent_count ?? "some"} agents. Detach those agents first.`);
      return;
    }
    setDeleteError(`Delete failed: HTTP ${r.status}`);
  };

  const statusIcon = (s: string | null) => {
    if (s === "ok") return <CheckCircle2 className="size-4 text-green-600" />;
    if (s && s !== "ok") return <XCircle className="size-4 text-red-600" />;
    return <CircleDashed className="size-4 text-gray-400" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => setShowAdd(true)}
          className="bg-[#0085CF] text-white hover:bg-[#0072B0]"
        >
          <Plus className="size-4" /> Add Provider
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card className="border-[#0085CF]/10 bg-white p-8 text-center text-gray-500">
          No providers yet. Add one to start using your own LLM keys.
        </Card>
      ) : (
        <Card className="border-[#0085CF]/10 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Kind</th>
                <th className="px-4 py-3 text-left font-medium">Default model</th>
                <th className="px-4 py-3 text-left font-medium">Key</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Used by</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((p) => (
                <tr key={p.id} className="text-gray-900">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{p.kind}</code>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.default_model ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.api_key_hint}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {statusIcon(p.last_test_status)}
                      <span className="text-xs text-gray-600">{p.last_test_status ?? "untested"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.agent_count} agents</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        onClick={() => onTest(p.id)}
                        disabled={testing === p.id}
                      >
                        {testing === p.id ? <Loader2 className="size-3 animate-spin" /> : "Test"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        onClick={() => setEditing(p)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-red-200 bg-white text-red-700 hover:bg-red-50"
                        onClick={() => setConfirmDelete(p)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showAdd && (
        <ProviderFormDialog
          mode="create"
          onClose={() => setShowAdd(false)}
          onSaved={async () => {
            setShowAdd(false);
            await refresh();
          }}
        />
      )}

      {editing && (
        <ProviderFormDialog
          mode="edit"
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}

      {confirmDelete && (
        <AlertDialog open onOpenChange={(o) => !o && (setConfirmDelete(null), setDeleteError(null))}>
          <AlertDialogContent className="bg-white text-gray-900">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-gray-900">Delete provider “{confirmDelete.name}”?</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-600">
                This is permanent. Any agent currently using this provider will block deletion until you migrate them.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteError && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</div>
            )}
            <AlertDialogFooter className="bg-gray-50 border-t border-gray-200">
              <AlertDialogCancel className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={() => onDelete(confirmDelete)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
