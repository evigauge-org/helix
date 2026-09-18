# ADR-0003 — JSON-RPC 2.0 over HTTP + SSE, with capability negotiation

- **Status:** Accepted
- **Date:** 2026-03-10
- **Depends on:** [ADR-0002](0002-runtime-embedder-split.md)

## Context

With the Runtime/Embedder split fixed, the wire format had to be chosen. The
constraint from G6 ("implementable in about a week") argues against anything
exotic; the constraint from G1/G2 (portability of both sides) argues for
primitives that existing infrastructure — proxies, gateways, observability —
already understands.

## Decision

**Be deliberately boring on the wire. Boring is portable.**

- **Transport:** HTTP/1.1 or HTTP/2, runtime's choice.
- **Requests:** JSON-RPC 2.0 at a single endpoint, `POST /aep/v1/rpc`. Methods
  are namespaced: `initialize`, `agent.*`, `run.*`, `memory.*`, `message.*`,
  `subject.*`.
- **Streaming:** Server-Sent Events at dedicated paths —
  `GET /aep/v1/runs/{run_id}/events`.
- **Binary:** artifact bytes served directly at
  `GET /aep/v1/artifacts/{id}/bytes` with native MIME types. No third-party
  storage appears in the protocol surface.
- **Session:** every request except `initialize` carries `X-AEP-Session-Id:
  ses_...`. `initialize` is the one method that establishes a session and so
  needs none.
- **Versioning:** calendar-versioned (`aep-YYYY-MM-DD`); every request carries
  `Agent-Protocol-Version`. A runtime may support several versions concurrently
  and rejects unknown ones with `version_mismatch`.

JSON-RPC 2.0 + SSE is the same family of primitives MCP and A2A already use, so
AEP slots into existing infrastructure without special handling.

## Capability negotiation

A session opens with an `initialize` handshake: the embedder *requests* a
capability set, the runtime *responds* with what it actually supports. v1
defines eight negotiated booleans:

`auth.oauth2`, `compliance.gdpr`, `tools.mcp_external`, `self.modify_prompt`,
`self.spawn_subagent`, `self.learning_memory`, `messaging.peer`, `streaming.sse`.

Using a capability the runtime did not advertise fails cleanly with
`capability_not_supported` (`-32002`).

This is the mechanism that lets a minimal runtime (tool execution only) and a
full runtime (self-improving, multi-agent, GDPR-compliant) speak the *same*
protocol and **degrade predictably**. A runtime without GDPR support advertises
`compliance.gdpr: false` and rejects every `subject.*` call — no guesswork for
the embedder, no capability sniffing.

## Event durability

Run events carry a monotonically increasing `event_id` per run and are retained
**at least 24 hours**, so an embedder can reconnect with `?since=<event_id>` and
miss nothing. This is what makes *"the agent ran for two days, here is
everything it did"* a protocol guarantee rather than a product feature.

## Consequences

- Calendar versioning means we must keep old versions servable during
  transitions, not just tag a semver bump.
- The error model needs app-level codes distinct from JSON-RPC's reserved
  range; `-32000..-32099` is claimed for AEP. See
  [ADR-0004](0004-scoped-api-keys-and-authz.md) for the authz codes.
