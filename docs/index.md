---
title: "Agent Execution Protocol (AEP) — specification and reference runtime"
description: >-
  AEP is an open, vendor-neutral wire protocol defining the contract between an
  agent runtime and an embedder: lifecycle, supervised self-modification,
  sub-agent spawning, learning memory and GDPR plumbing. Helix is its reference
  runtime.
permalink: /
---

# The Agent Execution Protocol

**The Agent Execution Protocol (AEP) is an open, vendor-neutral wire protocol
that defines the contract between an *agent runtime* — any service that hosts
long-lived autonomous agents — and an *embedder*, meaning any UI, orchestrator
or application that drives those agents.** It specifies the execution model of
a single long-lived agent: how it sleeps and wakes, how it bounds its own risk,
how it modifies its own prompt under policy, how it spawns and supervises
sub-agents, and how privacy obligations travel with the data it touches.

The frozen specification version is `aep-2026-04-24`. The wire layer is
JSON-RPC 2.0 over HTTP with Server-Sent Event streams, and capabilities are
negotiated at `initialize` rather than assumed.

**[Helix](https://github.com/evigauge-org/helix) is the reference runtime for
AEP.** It serves the protocol at `/aep/v1` and ships the product built on top
of it: agent authoring, run observability, artifact generation, memory, and the
settings surface around credentials, providers and privacy.

![The Helix run timeline: an agent's reasoning, a knowledge-base lookup, its results, and an outbound email queued for human approval](images/helix-run-timeline.png)

## How is AEP different from MCP?

They solve different planes and are designed to compose.

The **Model Context Protocol (MCP)** standardises how an agent reaches a
*tool*. It is explicitly silent on agent lifecycle, autonomy, self-modification,
replication and inter-agent coordination. AEP treats that as a feature rather
than a deficiency: **AEP composes with MCP at the tool plane and does not
attempt to redefine it.** Every tool an AEP agent reaches, local or remote, is
reached through MCP semantics.

Agent-to-agent protocols such as **A2A and ACP** standardise how one *opaque*
agent messages another. They prescribe how agents talk, not how an agent is
governed internally — its constitution, ceilings, budgets, self-modification
policy or learning memory.

Agent frameworks — CrewAI, AutoGen, LangGraph — provide runtimes, but each is a
single-vendor runtime. Portability between them is not a contract; it is a
rewrite.

The gap AEP fills is the one between those: **the execution model of a single
long-lived autonomous agent**, expressed portably enough that a runtime and an
embedder written by different people interoperate.

## What does an AEP runtime guarantee?

- **Bounded autonomy.** Spawning sub-agents, modifying one's own prompt,
  writing learning memory and peer messaging are protocol primitives, but each
  is bounded by ceilings, budgets, policies and a trust boundary.
- **An immutable toolset.** Agents cannot modify their own toolset at runtime.
  Tools are declared at creation — an explicit safety veto.
- **A complete audit trail.** Every tool call, its arguments and its result are
  written before the next step begins, and the same run is replayable over the
  AEP event stream.
- **Human decisions on irreversible actions.** A tool call the runtime will not
  make alone is recorded as queued and deferred, and dispatches only after an
  approval is recorded against it.
- **Compliance as a protocol concern.** A `subject_id` rides with any object
  that may contain PII; `subject.export`, `subject.erase` and `subject.read`
  are protocol methods gated by a capability.

AEP deliberately does **not** define agent cognition. It governs the execution
shell, not the brain.

## Documentation

<div class="cards" markdown="0">
  <div class="card">
    <h3><a href="whitepaper/">Whitepaper</a></h3>
    <p>The protocol in full: the gap it fills, its architecture, the self-* capability model, and a capability-matrix comparison with MCP, A2A and the frameworks.</p>
  </div>
  <div class="card">
    <h3><a href="https://github.com/evigauge-org/helix#readme">Getting started</a></h3>
    <p>Install, configure and run the reference runtime, plus the full environment-variable reference.</p>
  </div>
  <div class="card">
    <h3><a href="decisions/">Architecture decisions</a></h3>
    <p>Six ADRs recording what was decided, what was rejected, and what it cost.</p>
  </div>
  <div class="card">
    <h3><a href="protocol/schemas/">JSON Schemas</a></h3>
    <p>The source of truth for both SDKs: machine-readable schemas for the <code>aep-2026-04-24</code> wire format, the RPC surface, events, resources and enums.</p>
  </div>
</div>

## Client SDKs

The TypeScript and Python clients are Apache-2.0 and live in a separate
repository, so you can build against an AEP runtime without taking on the
Helix repository's licence.

```bash
npm install @helixsdk/core
pip install helixsdk
```

Source: [evigauge-org/helix-sdk](https://github.com/evigauge-org/helix-sdk) ·
[npm](https://www.npmjs.com/package/@helixsdk/core) ·
[PyPI](https://pypi.org/project/helixsdk/)

## Running the reference runtime

Helix is a Next.js application. It needs Node 20+ (or Bun), Postgres 14+, and
API keys only for the integrations you intend to exercise — an absent key
disables its feature cleanly rather than crashing the app.

```bash
git clone https://github.com/evigauge-org/helix.git
cd helix
npm install
cp .env.example .env
npx prisma migrate deploy
npm run dev
```

Full setup, configuration and command reference:
[README on GitHub](https://github.com/evigauge-org/helix#getting-started).

## Licence

The protocol specification and the client SDKs are Apache-2.0. Helix itself is
**source-available, not open source**, under the Fair Source License Agreement
1.0: free for organisations under US$1,000,000 annual revenue, exempt for
academic and non-profit research institutions, and requiring a commercial
licence above that threshold. See
[LICENSE.md](https://github.com/evigauge-org/helix/blob/main/LICENSE.md).
