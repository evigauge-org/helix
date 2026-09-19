---
title: "Architecture decision records"
description: >-
  Six ADRs behind AEP and Helix: what was decided, which alternatives were rejected, and the consequences that were accepted.
permalink: /decisions/
---

# Architecture Decision Records

Design decisions behind the **Agent Execution Protocol (AEP)** and its reference
runtime, **Helix**.

Each record captures the context that forced a decision, the decision itself,
the alternatives that were rejected, and the consequences we accepted. The
`Date` field records **when the decision was made**, which is not always when it
was written down or implemented.

| # | Decision | Date | Status |
|---|---|---|---|
| [0001](0001-why-a-new-protocol.md) | Why AEP is a new protocol, not an MCP/A2A extension | 2026-01-14 | Accepted |
| [0002](0002-runtime-embedder-split.md) | Two roles only: Runtime and Embedder | 2026-02-11 | Accepted |
| [0003](0003-wire-protocol-and-capability-negotiation.md) | JSON-RPC 2.0 over HTTP + SSE, with capability negotiation | 2026-03-10 | Accepted |
| [0004](0004-scoped-api-keys-and-authz.md) | Scoped API keys and the authorization vocabulary | 2026-04-15 | Accepted |
| [0005](0005-oauth2-and-external-mcp.md) | OAuth 2.1 and external MCP servers | 2026-05-13 | Accepted |
| [0006](0006-byo-llm-provider-model.md) | BYO-LLM: provider kinds, key custody, agent binding | 2026-06-17 | Accepted |

## Reading order

0001 → 0002 establishes *what AEP is and is not*. 0003 fixes the wire layer.
0004 → 0005 build the security model outward from static keys to delegated
OAuth and third-party tools. 0006 handles the one product need the protocol
deliberately refuses to specify.

## Related documents

- [`docs/AEP-Whitepaper.md`](../AEP-Whitepaper.md) — the protocol paper
- [`docs/protocol/schemas/aep-2026-04-24.schema.json`](../protocol/schemas/aep-2026-04-24.schema.json) — frozen v1 schema
- [`docs/API-Reference.md`](../API-Reference.md) — method-level reference

## Open reconciliation

Whitepaper Appendix A lists 12 authorization scopes; `lib/aep/authz/scopes.ts`
defines 14 (adding `provider.read` / `provider.write`). See ADR-0004 and
ADR-0006 — the extra two are runtime scopes rather than protocol scopes, and the
appendix should state that rather than omitting them silently.
