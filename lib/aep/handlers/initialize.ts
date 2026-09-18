// lib/aep/handlers/initialize.ts
import { prisma } from "@/lib/prisma";
import { PROTOCOL_VERSION } from "../context";
import { AepError } from "../errors";
import { newAepId } from "../ids";

interface InitializeParams {
  client_info: { name: string; version: string };
  requested_versions: string[];
  requested_capabilities: Record<string, boolean>;
}

interface InitializeResult {
  server_info: { name: string; version: string };
  protocol_version: string;
  capabilities: Record<string, boolean>;
  session_id: string;
}

const SUPPORTED_CAPABILITIES: Record<string, boolean> = {
  "auth.oauth2": true,               // Plan 4 — OAuth 2.1 PKCE flow + scoped tokens
  "compliance.gdpr": true,           // Plan 6 — subject.read/export/erase + audit log
  "runner.byo_llm": true,            // Plan 7 — per-user LLM provider credentials
  "tools.mcp_external": true,        // Plan 5 — external MCP servers attached at agent.create
  "self.modify_prompt": true,
  "self.spawn_subagent": true,
  "self.learning_memory": true,
  "messaging.peer": true,
  "streaming.sse": true,
};

export async function initialize(
  params: InitializeParams,
  ctx: { userId: string },
): Promise<InitializeResult> {
  if (!params.requested_versions.includes(PROTOCOL_VERSION)) {
    throw new AepError("version_mismatch",
      `Server supports ${PROTOCOL_VERSION}; client requested ${params.requested_versions.join(",")}`);
  }

  // Negotiate: AND of requested and supported
  const negotiated: Record<string, boolean> = {};
  for (const [cap, want] of Object.entries(params.requested_capabilities)) {
    negotiated[cap] = Boolean(want) && Boolean(SUPPORTED_CAPABILITIES[cap]);
  }

  const sessionAepId = newAepId("ses");
  await prisma.aepSession.create({
    data: {
      aepId: sessionAepId,
      userId: ctx.userId,
      protocolVersion: PROTOCOL_VERSION,
      negotiatedCapabilities: negotiated,
      clientName: params.client_info.name,
      clientVersion: params.client_info.version,
    },
  });

  return {
    server_info: { name: "helix-aep-runtime", version: "0.1.0" },
    protocol_version: PROTOCOL_VERSION,
    capabilities: negotiated,
    session_id: sessionAepId,
  };
}
