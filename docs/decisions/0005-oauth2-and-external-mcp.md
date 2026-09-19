---
title: "ADR-0005 — OAuth 2.1 and external MCP servers"
description: >-
  Static scoped keys suit a first-party embedder but cannot be delegated, scoped per user or revoked independently. OAuth 2.1 as an advertised capability, and reaching external tools over MCP.
permalink: /decisions/0005-oauth2-and-external-mcp/
---

# ADR-0005 — OAuth 2.1 and external MCP servers

- **Status:** Accepted
- **Date:** 2026-05-13
- **Depends on:** [ADR-0004](0004-scoped-api-keys-and-authz.md)

## Context

ADR-0004 gave us static scoped keys (`hlx_...`), which are fine for a first-party
embedder but wrong for third-party ones: they cannot be delegated, scoped down
per-user, or revoked independently. Separately, G4 requires that *every* tool be
reached through MCP semantics — including tools that live outside the runtime.

## Decision: OAuth 2.1 as an advertised capability

When a runtime advertises `auth.oauth2`, OAuth 2.1 flows are available and
discoverable via `.well-known/oauth-authorization-server`. Static keys remain
supported; OAuth is additive, not a replacement. The scope vocabulary from
ADR-0004 is reused verbatim as the OAuth scope set, so there is exactly one
permission model regardless of how the token was obtained.

## Decision: two tool paths, one uniform tool list

The agent sees a single tool list regardless of where a tool physically lives.

- **Path A — in-process modules.** Tools bundled with the runtime, wrapped as a
  *local in-memory MCP server* at boot. In Helix these are namespaced `helix.*`
  (`helix.create_docx`, `helix.web_search`, …).
- **Path B — external MCP servers.** Attached at `agent.create` via
  `external_mcp_servers: [{url, auth, name?}]`. The runtime connects, merges the
  remote tool list into the agent's effective toolset and routes calls over
  standard MCP transport (stdio, HTTP+SSE). Gated by the `tools.mcp_external`
  capability.

On every invocation the runtime resolves the tool's source by namespace prefix,
applies budget/ceiling/scope checks, then **propagates execution context** —
`session_id`, `agent_id`, `run_id`, `subject_id(s)` — to the MCP server via
MCP-standard `_meta`, so downstream tools can tag their outputs for compliance.

Tool metadata carries `requires_subject_id`, `side_effect_class`
(`read | write | external`) and `cost_hint`. These are **advisory** inputs the
runtime uses for budget and retry decisions, not enforcement.

## Consequences

- The whole existing MCP ecosystem becomes reachable from any AEP agent, and
  AEP contributes the governance layer MCP deliberately omits.
- NG4 still holds: attaching external servers happens at `agent.create`, by the
  *creator*. The agent cannot add servers to itself mid-run. A tool outside the
  effective toolset yields `tool_not_found` (`-32008`).
- Credentials for external servers are runtime-held. They never enter the
  protocol surface and never reach the model context.
- Context propagation via `_meta` is what makes GDPR erasure reach data written
  by third-party tools — without it, `subject.erase` would only ever see
  first-party records.
