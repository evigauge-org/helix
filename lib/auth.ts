import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { bearer } from "better-auth/plugins";
import { apiKey } from "@better-auth/api-key";
import { oauthProvider } from "@better-auth/oauth-provider";
import { prisma } from "@/lib/prisma";
import { AEP_SCOPES } from "@/lib/aep/authz/scopes";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  plugins: [
    // apiKey lets long-lived `hlx_...` keys authenticate non-browser clients
    // (Python SDK, MCP servers, third-party agents). enableSessionForAPIKeys
    // makes a valid key resolve through `auth.api.getSession()` so existing
    // protected routes accept it without per-route changes.
    //
    // customAPIKeyGetter accepts BOTH conventions:
    //   - `x-api-key: hlx_...`             (curl-friendly)
    //   - `Authorization: Bearer hlx_...`  (matches AEP SDK's bearer field)
    // The Bearer prefix is only treated as an API key when the token starts
    // with `hlx_`, so it doesn't conflict with the session-token bearer plugin.
    apiKey({
      defaultPrefix: "hlx_",
      requireName: true,
      references: "user",
      enableSessionForAPIKeys: true,
      rateLimit: { enabled: false },
      keyExpiration: { defaultExpiresIn: null },
      // Prisma camelCases PascalCase model names: `model ApiKey` is exposed as
      // `prisma.apiKey`. The plugin's default model name is "apikey" (lowercase),
      // so the adapter does `db["apikey"]` and finds nothing. Map it explicitly.
      schema: {
        apikey: { modelName: "apiKey" },
      },
      customAPIKeyGetter: (ctx) => {
        // Read from ctx.headers (always present), NOT ctx.request?.headers.
        // Server-side calls like `auth.api.getSession({ headers })` populate
        // ctx.headers but leave ctx.request undefined — so our AEP route's
        // getSession would otherwise silently miss the api-key.
        const xKey = ctx.headers?.get("x-api-key");
        if (xKey) return xKey;
        const authz = ctx.headers?.get("authorization");
        if (authz?.startsWith("Bearer hlx_")) return authz.slice(7);
        return null;
      },
    }),
    // OAuth 2.1 authorization server. Lets third-party apps (Slack bots,
    // Zapier connectors, marketplace agents) obtain scoped tokens for users'
    // Helix accounts via the standard authorization-code flow with PKCE.
    // The plugin auto-mounts /.well-known/openid-configuration, /oauth2/authorize,
    // /oauth2/token, /oauth2/userinfo, /oauth2/register. We just configure scopes,
    // the consent page URL, and (Plan 4 trick) the Prisma model name overrides
    // because Prisma camelCases PascalCase model names: `model OAuthClient` is
    // exposed as `prisma.oAuthClient`, but the plugin's default model name is
    // "oauthClient" (all-lowercase first segment).
    oauthProvider({
      loginPage: "/",
      consentPage: "/oauth/authorize",
      // Plain OAuth 2.1, not OIDC. Including "openid" in scopes would flip
      // the plugin into OIDC mode and require @better-auth/jwt for signing
      // id_tokens. We don't issue id_tokens — third-party apps just need
      // scoped access tokens to call AEP. `offline_access` is OAuth-standard
      // and stays so refresh tokens work.
      scopes: ["offline_access", ...AEP_SCOPES],
      requirePKCE: true,
      // disableJwtPlugin: true means access tokens are opaque (looked up via
      // oauth_access_token table), no JWT signing path. With this flag,
      // storeClientSecret must be "encrypted" (uses BETTER_AUTH_SECRET); the
      // "hashed" mode requires the JWT plugin we don't have.
      disableJwtPlugin: true,
      storeClientSecret: "encrypted",
      allowDynamicClientRegistration: true,
      schema: {
        oauthClient:       { modelName: "oAuthClient" },
        oauthAccessToken:  { modelName: "oAuthAccessToken" },
        oauthRefreshToken: { modelName: "oAuthRefreshToken" },
        oauthConsent:      { modelName: "oAuthConsent" },
      },
    }),
    // bearer() converts `Authorization: Bearer <session-token>` to a session
    // cookie. Runs after apiKey so hlx_ keys are claimed there first.
    bearer(),
    nextCookies(),
  ],
});
