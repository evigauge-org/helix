// app/(authenticated)/oauth/authorize/page.tsx
//
// OAuth 2.1 consent page. The @better-auth/oauth-provider plugin redirects the
// user here from /api/auth/oauth2/authorize with the entire signed authorize
// query string in URL params. We render the requesting client's name + icon +
// scopes, and on Approve/Deny POST { accept, oauth_query } to
// /api/auth/oauth2/consent which returns { redirect_uri } that we navigate to.

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ConsentForm } from "./consent-form";

interface SearchParams {
  client_id?: string;
  scope?: string;
  // The plugin appends `exp` and `sig` so we MUST pass the entire query back
  // to /oauth2/consent in `oauth_query`. We don't parse those — we just
  // serialize whatever came in.
  [key: string]: string | string[] | undefined;
}

export default async function OAuthAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const clientId = typeof params.client_id === "string" ? params.client_id : null;
  if (!clientId) redirect("/");

  const client = await prisma.oAuthClient.findUnique({
    where: { clientId },
    select: { name: true, icon: true, uri: true, tos: true, policy: true },
  });
  if (!client) redirect("/");

  const requestedScopes = typeof params.scope === "string"
    ? params.scope.split(/\s+/).filter(Boolean)
    : [];

  // Reserialize exactly what came in so the plugin can verify the signature.
  const oauthQuery = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string") oauthQuery.set(k, v);
    else if (Array.isArray(v)) v.forEach((item) => oauthQuery.append(k, item));
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <ConsentForm
          clientName={client.name ?? clientId}
          clientIcon={client.icon ?? null}
          clientUri={client.uri ?? null}
          tos={client.tos ?? null}
          policy={client.policy ?? null}
          requestedScopes={requestedScopes}
          oauthQuery={oauthQuery.toString()}
        />
      </div>
    </div>
  );
}
