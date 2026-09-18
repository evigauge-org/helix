// lib/aep/authz/scopes.ts
//
// AEP scope vocabulary (spec §6.3) plus the legacy/UI wildcard. Storage shape
// on better-auth's apikey.permissions column is `{ "aep": [scope, ...] }`.

export const AEP_SCOPES = [
  "agent.read",
  "agent.write",
  "run.read",
  "run.create",
  "run.cancel",
  "stream.subscribe",
  "memory.read",
  "memory.write",
  "tool.invoke",
  "subject.read",
  "subject.erase",
  "subject.export",
  "provider.read",
  "provider.write",
] as const;

export type AepScope = (typeof AEP_SCOPES)[number];

export const AEP_WILDCARD = "aep:*" as const;
export type AepScopeOrWildcard = AepScope | typeof AEP_WILDCARD;

export function hasScope(granted: readonly string[], required: AepScope): boolean {
  return granted.includes(AEP_WILDCARD) || granted.includes(required);
}

// Human-friendly groupings shown in the create-key UI.
export const SCOPE_GROUPS: { label: string; description: string; scopes: AepScope[] }[] = [
  {
    label: "Agents",
    description: "Read or modify agents you own.",
    scopes: ["agent.read", "agent.write"],
  },
  {
    label: "Runs",
    description: "Start, read, or cancel runs on your agents.",
    scopes: ["run.create", "run.read", "run.cancel"],
  },
  {
    label: "Streaming",
    description: "Open SSE streams for live run events.",
    scopes: ["stream.subscribe"],
  },
  {
    label: "Memory",
    description: "Read or write learning memory on your agents.",
    scopes: ["memory.read", "memory.write"],
  },
  {
    label: "Tools",
    description: "Invoke tools (rarely issued to embedders — agents use this internally).",
    scopes: ["tool.invoke"],
  },
  {
    label: "GDPR",
    description: "Subject access and erasure (DSAR). Sensitive — only enable for compliance tools.",
    scopes: ["subject.read", "subject.erase", "subject.export"],
  },
  {
    label: "LLM Providers",
    description: "Read or modify your stored LLM credentials (BYO LLM).",
    scopes: ["provider.read", "provider.write"],
  },
];
