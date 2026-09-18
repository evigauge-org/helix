# ADR-0002 — Two roles only: Runtime and Embedder

- **Status:** Accepted
- **Date:** 2026-02-11
- **Depends on:** [ADR-0001](0001-why-a-new-protocol.md)

## Context

ADR-0001 committed us to a protocol rather than a framework. A protocol needs a
role split sharp enough that both sides can be implemented independently, by
different teams, in different languages, without coordination.

## Decision

AEP defines **exactly two roles**:

- A **Runtime** implements AEP and hosts agents. It runs cycles, persists state
  between cycles, brokers tool calls through MCP, delivers messages and streams
  events. Helix is the reference runtime.
- An **Embedder** talks to a runtime over AEP: creates agents, starts runs,
  subscribes to event streams. A chat UI, a Slack bot and an ops dashboard are
  all embedders.

The wire protocol is the *only* coupling. An embedder written once drives any
conforming runtime; a runtime exposes the same surface to every embedder.

## The goal / non-goal pairing

Six goals shape the architecture. The load-bearing ones:

| ID | Goal |
|---|---|
| G1/G2 | Portability of **both** sides — anyone can build a runtime *and* an embedder. |
| G3 | First-class self-\* with safety boundaries — spawn, prompt-modify, memory, peer messaging are protocol primitives, always bounded by ceilings, budgets and policy. |
| G4 | MCP at the tool plane — every tool, local or remote, reached through MCP semantics. |
| G5 | Compliance as a core concern — `subject_id` rides with any object that may contain PII. |
| G6 | Implementable in about a week for the wire layer. |

The **non-goals** matter as much, because they are what keep the protocol small
enough to stay durable:

- **NG1** — AEP does not define agent *cognition*. It governs the execution
  shell, not the brain.
- **NG4** — Agents **cannot modify their own toolset** at runtime. Tools are
  declared at creation and are immutable to the agent. This is an explicit
  safety veto, not an oversight.
- **NG5** — No cross-tree peer messaging in v1. Coordination is confined to the
  agent *tree* as a trust boundary.
- **NG2/NG3/NG6/NG7** — No hosted multi-tenant runtime, no model selection, no
  control-plane UI, no mandated retention policy. All runtime-specific product
  concerns, deliberately outside the protocol.

## Consequences

The thesis this encodes: **maximal autonomy inside a strict, declarative cage.**
An agent may rewrite its prompt, spawn helpers and accumulate memory — but only
within ceilings it cannot raise, under a constitution it cannot fully unlock,
inside a tree it cannot escape, using tools it cannot extend.

Because NG3 keeps model selection out of the protocol, provider choice becomes a
runtime concern — see [ADR-0006](0006-byo-llm-provider-model.md).
