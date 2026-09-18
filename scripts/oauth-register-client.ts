// scripts/oauth-register-client.ts
//
// Admin CLI to register a first-party OAuth client by hitting the running
// dev server's /api/auth/oauth2/create-client endpoint. Requires:
//   - Dev server running at AEP_BASE_URL (default http://localhost:3000)
//   - HELIX_ADMIN_API_KEY env set to an hlx_… key with aep:* scope
//     (e.g. the legacy backfilled smoke key).
//
// Usage:
//   bun run scripts/oauth-register-client.ts \
//     --name "Helix CLI" \
//     --redirect-url "http://localhost:7777/callback" \
//     --type native
//
// Flags:
//   --name <string>           Display name shown on the consent page (required)
//   --redirect-url <url>      Allowed redirect URI; pass multiple times for >1
//   --type <web|native|public>  Default: native
//   --uri <string>            Optional homepage URL shown on consent page
//   --logo <url>              Optional icon URL
//
// Public clients (type=native, type=user-agent-based) get NO client_secret —
// they use PKCE. Confidential clients (type=web) get a hashed secret printed
// once to stdout.

interface Args {
  name?: string;
  redirectUrls: string[];
  type: "web" | "native" | "user-agent-based";
  uri?: string;
  logo?: string;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { redirectUrls: [], type: "native" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    switch (a) {
      case "--name":
        out.name = next;
        i++;
        break;
      case "--redirect-url":
        if (next) out.redirectUrls.push(next);
        i++;
        break;
      case "--type":
        if (next === "web" || next === "native" || next === "user-agent-based") out.type = next;
        i++;
        break;
      case "--uri":
        out.uri = next;
        i++;
        break;
      case "--logo":
        out.logo = next;
        i++;
        break;
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.name) throw new Error("--name is required");
  if (args.redirectUrls.length === 0) throw new Error("at least one --redirect-url is required");

  const baseUrl = process.env.AEP_BASE_URL ?? "http://localhost:3000";
  const adminKey = process.env.HELIX_ADMIN_API_KEY;
  if (!adminKey) throw new Error("HELIX_ADMIN_API_KEY env var is required");

  const tokenEndpointAuthMethod = args.type === "web" ? "client_secret_basic" : "none";

  const res = await fetch(`${baseUrl}/api/auth/oauth2/create-client`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminKey}`,
    },
    body: JSON.stringify({
      redirect_uris: args.redirectUrls,
      client_name: args.name,
      client_uri: args.uri,
      logo_uri: args.logo,
      type: args.type,
      token_endpoint_auth_method: tokenEndpointAuthMethod,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`HTTP ${res.status}: ${text}`);
    process.exit(1);
  }

  const data = (await res.json()) as { client_id?: string; client_secret?: string; [k: string]: unknown };
  console.log("\n✅ OAuth client registered\n");
  console.log(`client_id:     ${data.client_id ?? "(missing)"}`);
  if (data.client_secret) {
    console.log(`client_secret: ${data.client_secret}`);
    console.log("\n⚠️  This is the only time the secret will be shown. Store it now.\n");
  } else {
    console.log("client_secret: (none — public client uses PKCE)\n");
  }
  if (process.env.OAUTH_DEBUG === "1") console.log("Full response:", data);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
