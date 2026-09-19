---
title: "ADR-0001 — Why AEP is a new protocol, not an MCP or A2A extension"
description: >-
  MCP standardises the tool plane and A2A-class protocols standardise messaging between opaque agents. Neither governs a single agent's internal execution model. Why that gap needed its own protocol.
permalink: /decisions/0001-why-a-new-protocol/
---

# ADR-0001 — Why AEP needs to be a new protocol

- **Status:** Accepted
- **Date:** 2026-01-14
- **Supersedes:** —

## Context

Two open standards already exist adjacent to the problem we have:

- **MCP** standardises the *tool plane*. JSON-RPC 2.0, three primitives (tools,
  resources, prompts), OAuth2 for tool invocation. It is explicitly silent on
  agent lifecycle, autonomy, self-modification and coordination.
- **A2A / ACP / AGP / ANP** standardise the *messaging plane between opaque
  agents*. They define how agents discover one another and exchange Tasks,
  Messages and Artifacts. Each agent stays a black box.

Neither describes the **execution model of a single long-lived agent**: how it
sleeps and wakes, how it bounds its own risk, how it rewrites its own prompt
under policy, how it spawns and supervises children, or how privacy obligations
travel with the data it touches.

Agent frameworks (CrewAI, AutoGen, LangGraph, Swarm) do provide those
behaviours — but each expresses them in its own API surface. That produces
**lock-in by omission**: if lifecycle, budgets, constitution, peer messaging and
learning memory are written against one framework's runtime, moving stacks is a
rewrite, not a migration.

## Decision

Define AEP as a distinct, vendor-neutral wire protocol covering the
runtime↔embedder contract, and **compose with MCP at the tool plane rather than
replace it**.

AEP is not another tool protocol and not another message bus. It is the contract
that lets a conforming *runtime* be built in any stack, and an *embedder* drive
any conforming runtime identically.

## Alternatives considered

1. **Extend MCP with lifecycle methods.** Rejected — MCP's silence on lifecycle
   is a deliberate scope boundary. Widening it would fork the ecosystem we want
   to consume.
2. **Extend A2A with intra-agent governance.** Rejected — A2A's opacity
   assumption is load-bearing. Governing an agent's internals contradicts
   treating it as a black box.
3. **Ship a framework, not a protocol.** Rejected — reproduces the exact
   lock-in this work exists to remove.

## Consequences

- We own a spec surface and must version it. Calendar versioning
  (`aep-YYYY-MM-DD`) is adopted so a runtime can support several versions.
- The entire existing MCP tool ecosystem stays reachable from any AEP agent.
- We must be disciplined about non-goals; see ADR-0002 for the role split and
  the goal/non-goal pairing that keeps the protocol small.
