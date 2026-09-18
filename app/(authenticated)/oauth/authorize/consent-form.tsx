"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AEP_SCOPES, SCOPE_GROUPS, type AepScope } from "@/lib/aep/authz/scopes";

const STANDARD_SCOPE_DESCRIPTIONS: Record<string, string> = {
  openid: "Sign you in.",
  profile: "Your name and basic profile.",
  email: "Your email address.",
  offline_access: "Stay connected when you're not actively using this app.",
};

function describeScope(scope: string): string {
  if (STANDARD_SCOPE_DESCRIPTIONS[scope]) return STANDARD_SCOPE_DESCRIPTIONS[scope];
  for (const group of SCOPE_GROUPS) {
    if ((group.scopes as readonly string[]).includes(scope)) {
      return group.description;
    }
  }
  return "Custom scope.";
}

function isAepScope(scope: string): scope is AepScope {
  return (AEP_SCOPES as readonly string[]).includes(scope);
}

interface Props {
  clientName: string;
  clientIcon: string | null;
  clientUri: string | null;
  tos: string | null;
  policy: string | null;
  requestedScopes: string[];
  oauthQuery: string;
}

export function ConsentForm({
  clientName,
  clientIcon,
  clientUri,
  tos,
  policy,
  requestedScopes,
  oauthQuery,
}: Props) {
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (accept: boolean) => {
    setBusy(accept ? "approve" : "deny");
    setError(null);
    try {
      const res = await fetch("/api/auth/oauth2/consent", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ accept, oauth_query: oauthQuery }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err?.message ?? `Consent failed (${res.status})`);
        setBusy(null);
        return;
      }
      const data = (await res.json()) as { redirect_uri?: string };
      if (!data.redirect_uri) {
        setError("Server returned no redirect URI");
        setBusy(null);
        return;
      }
      window.location.href = data.redirect_uri;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5 text-gray-900">
      <div className="flex items-start gap-3">
        {clientIcon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={clientIcon} alt="" className="size-12 rounded-lg border border-gray-200 object-cover" />
        ) : (
          <div className="flex size-12 items-center justify-center rounded-lg bg-[#0085CF]/10">
            <ShieldCheck className="size-6 text-[#0085CF]" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-gray-500">Authorize</p>
          <h1 className="mt-0.5 text-lg font-semibold text-gray-900">{clientName}</h1>
          {clientUri && (
            <a
              href={clientUri}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-block text-xs text-[#0085CF] hover:underline"
            >
              {new URL(clientUri).hostname}
            </a>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-700">
        <span className="font-medium">{clientName}</span> is requesting access to your Helix account. Review the
        permissions below before approving.
      </p>

      <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-600">This app will be able to:</p>
        <ul className="space-y-2">
          {requestedScopes.length === 0 ? (
            <li className="text-xs text-gray-500">No scopes requested.</li>
          ) : (
            requestedScopes.map((s) => (
              <li key={s} className="flex items-start gap-2">
                <Badge
                  variant="secondary"
                  className={
                    isAepScope(s)
                      ? "shrink-0 bg-[#0085CF]/10 font-mono text-[11px] text-[#0085CF]"
                      : "shrink-0 bg-gray-200 font-mono text-[11px] text-gray-700"
                  }
                >
                  {s}
                </Badge>
                <span className="text-xs text-gray-700">{describeScope(s)}</span>
              </li>
            ))
          )}
        </ul>
      </div>

      {(tos || policy) && (
        <p className="text-xs text-gray-500">
          By approving, you agree to {clientName}'s{" "}
          {tos && (
            <>
              <a href={tos} target="_blank" rel="noopener noreferrer" className="text-[#0085CF] hover:underline">
                Terms
              </a>
              {policy && " and "}
            </>
          )}
          {policy && (
            <a href={policy} target="_blank" rel="noopener noreferrer" className="text-[#0085CF] hover:underline">
              Privacy Policy
            </a>
          )}
          .
        </p>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          onClick={() => submit(false)}
          disabled={busy !== null}
          className="flex-1 border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900"
        >
          {busy === "deny" && <Loader2 className="size-4 animate-spin" />}
          Deny
        </Button>
        <Button
          onClick={() => submit(true)}
          disabled={busy !== null}
          className="flex-1 bg-[#0085CF] text-white hover:bg-[#0085CF]/90"
        >
          {busy === "approve" && <Loader2 className="size-4 animate-spin" />}
          Approve
        </Button>
      </div>

      <p className="text-center text-xs text-gray-400">
        You can revoke access any time at{" "}
        <a href="/settings/connected-apps" className="text-[#0085CF] hover:underline">
          Settings → Connected Apps
        </a>
        .
      </p>
    </div>
  );
}
