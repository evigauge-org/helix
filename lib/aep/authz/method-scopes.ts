// lib/aep/authz/method-scopes.ts
//
// Method ↔ scope mapping. Mirrors the surface of lib/aep/rpc/capability-gates.ts.
// Capabilities and scopes are orthogonal — both can apply to the same method.
// Methods absent from this map require NO scope (e.g. `initialize` is the
// negotiation handshake itself; gating it would be a chicken-and-egg).

import type { AepScope } from "./scopes";

export const methodScopeMap: Record<string, AepScope | undefined> = {
  "initialize": undefined,

  "agent.create": "agent.write",
  "agent.update": "agent.write",
  "agent.cancel": "agent.write",
  "agent.archive": "agent.write",
  "agent.approve_prompt_change": "agent.write",
  "agent.get": "agent.read",
  "agent.list": "agent.read",

  "run.create": "run.create",
  "run.continue": "run.create",
  "run.cancel": "run.cancel",
  "run.get": "run.read",
  "run.list": "run.read",

  "artifact.get": "run.read",
  "artifact.list": "run.read",
  "artifact.delete": "run.create", // mutates run output → write-side

  "memory.read": "memory.read",
  "memory.search": "memory.read",
  "memory.write": "memory.write",
  "memory.delete": "memory.write",

  "message.send": "run.create",
  "message.inbox": "run.read",
  "message.list": "run.read",

  "subject.export": "subject.export",
  "subject.read": "subject.read",
  "subject.erase": "subject.erase",

  "provider.list": "provider.read",
};
