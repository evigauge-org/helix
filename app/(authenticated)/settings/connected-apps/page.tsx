"use client";

import { useEffect, useState } from "react";
import { Loader2, Plug, ShieldCheck, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ConnectedApp = {
  id: string;
  clientId: string;
  clientName: string;
  clientIcon: string | null;
  clientUri: string | null;
  scopes: string[];
  createdAt: string;
  expiresAt: string;
};

export default function ConnectedAppsPage() {
  const [apps, setApps] = useState<ConnectedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/connected-apps", { credentials: "include" });
      if (!res.ok) {
        setApps([]);
        return;
      }
      const data = (await res.json()) as ConnectedApp[];
      setApps(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleRevoke = async () => {
    if (!revokeId) return;
    setRevokeBusy(true);
    try {
      await fetch("/api/me/connected-apps/revoke", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId: revokeId }),
      });
      setRevokeId(null);
      await load();
    } finally {
      setRevokeBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Connected Apps</h1>
        <p className="mt-1 text-sm text-gray-500">
          Third-party apps that can access your Helix account on your behalf. Each app only has the scopes you
          approved when you connected it. Disconnect to immediately revoke access.
        </p>
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-gray-500">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : apps.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <Plug className="size-8 text-gray-300" />
            <p className="text-sm text-gray-500">
              No third-party apps connected. Apps that ask for access to your Helix account will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {apps.map((a) => (
              <div key={a.id} className="flex items-start gap-4 p-4">
                {a.clientIcon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.clientIcon}
                    alt=""
                    className="size-10 shrink-0 rounded-lg border border-gray-200 object-cover"
                  />
                ) : (
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#0085CF]/10">
                    <ShieldCheck className="size-5 text-[#0085CF]" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-gray-900">{a.clientName}</p>
                    {a.clientUri && (
                      <a
                        href={a.clientUri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#0085CF] hover:underline"
                      >
                        {(() => {
                          try {
                            return new URL(a.clientUri).hostname;
                          } catch {
                            return a.clientUri;
                          }
                        })()}
                      </a>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {a.scopes.length === 0 ? (
                      <Badge variant="outline" className="text-xs text-gray-500">
                        no scopes
                      </Badge>
                    ) : (
                      a.scopes.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs font-mono">
                          {s}
                        </Badge>
                      ))
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-400">
                    Connected {new Date(a.createdAt).toLocaleDateString()} · Expires{" "}
                    {new Date(a.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRevokeId(a.id)}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="size-4" />
                  Disconnect
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={revokeId !== null} onOpenChange={(open) => !open && setRevokeId(null)}>
        <AlertDialogContent className="bg-white text-gray-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900">Disconnect this app?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500">
              The app will lose access to your Helix account immediately. To reconnect later, you&apos;ll have to
              approve it again from scratch.
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
              onClick={handleRevoke}
              disabled={revokeBusy}
              className="bg-red-600 hover:bg-red-700"
            >
              {revokeBusy && <Loader2 className="size-4 animate-spin" />}
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
