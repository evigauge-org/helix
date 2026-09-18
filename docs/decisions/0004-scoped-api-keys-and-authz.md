# ADR-0004 — Scoped API keys and the authorization vocabulary

- **Status:** Accepted
- **Date:** 2026-04-15
- **Depends on:** [ADR-0003](0003-wire-protocol-and-capability-negotiation.md)

## Context

Capability negotiation (ADR-0003) answers *"can this runtime do X?"*. It does
not answer *"may this caller do X?"*. Those are different axes and conflating
them would mean a runtime that advertises `compliance.gdpr: true` implicitly
grants every embedder the right to erase subjects.

## Decision

Separate the two axes:

- **Capabilities** are negotiated per session and describe the *runtime's*
  abilities.
- **Scopes** are bound to the *token* and describe the caller's permissions.

Every request carries `Authorization: Bearer <token>`. Tokens are opaque to the
protocol and bound to a single runtime (the `audience` claim matches the
runtime). In Helix, scoped static keys use the `hlx_` prefix.

### Scope vocabulary

Space-separated. The protocol-level v1 set:

`agent.read`, `agent.write`, `run.read`, `run.create`, `run.cancel`,
`stream.subscribe`, `memory.read`, `memory.write`, `tool.invoke`,
`subject.read`, `subject.erase`, `subject.export`

`tool.invoke` is normally issued to agents internally rather than to embedders.

Storage shape on better-auth's `apikey.permissions` column is
`{ "aep": [scope, ...] }`. A wildcard `aep:*` exists for the UI/legacy path;
`hasScope()` in `lib/aep/authz/scopes.ts` treats it as granting everything.

### Known drift

`lib/aep/authz/scopes.ts` currently defines **14** scopes — the 12 above plus
`provider.read` and `provider.write`, added for the BYO-LLM provider surface
(see [ADR-0006](0006-byo-llm-provider-model.md)). Whitepaper Appendix A still
lists 12. The two are out of sync; the implementation is authoritative and the
whitepaper appendix should be reconciled.

## Error model

App codes occupy `-32000..-32099`:

| Code | Symbol | Meaning |
|---|---|---|
| -32000 | `authn_failed` | Bad or missing token. |
| -32001 | `authz_denied` | Token valid, insufficient scope. |
| -32002 | `capability_not_supported` | Feature not negotiated / advertised false. |
| -32003 | `ceiling_exceeded` | Hard ceiling hit. |
| -32004 | `budget_exhausted` | Cycle budget exhausted. |
| -32005 | `tree_boundary_violation` | Cross-tree operation attempted. |
| -32006 | `subject_not_found` | DSAR/erasure against unknown subject. |
| -32007 | `constitution_policy_violation` | `modify_own_prompt` against policy. |
| -32008 | `tool_not_found` | Tool not in effective toolset. |
| -32009 | `version_mismatch` | Requested protocol version unsupported. |
| -32010 | `session_expired` | Session TTL elapsed. |
| -32011 | `lifecycle_conflict` | Operation invalid in current lifecycle state. |

`authn_failed` and `authz_denied` being distinct codes is intentional — an
embedder must be able to tell "refresh your token" from "ask for more scope".

## Consequences

- Scope checks live in `lib/aep/authz/method-scopes.ts`, mapping each JSON-RPC
  method to its required scope. Adding a method without adding a mapping is a
  silent authz hole; that mapping table is the thing to review.
- `lifecycle_conflict` covers the ceilings rule: a running agent's ceilings may
  be **shrunk but never widened**.
