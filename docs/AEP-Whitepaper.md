---
title: "The Agent Execution Protocol (AEP) — white paper"
description: >-
  The full AEP specification: the protocol gap between MCP's tool plane and A2A's messaging plane, the runtime/embedder architecture, JSON-RPC 2.0 over HTTP with SSE, capability negotiation, and the self-* capability model for long-lived autonomous agents.
permalink: /whitepaper/
---

# The Agent Execution Protocol (AEP)

### An Open, Vendor-Neutral Protocol for Long-Lived, Self-Improving Autonomous Agents

**A Helix Technical White Paper**

| | |
|---|---|
| **Protocol version** | `aep-2026-04-24` |
| **Reference runtime** | Helix |
| **Status** | Specification frozen; reference runtime conformance in progress |
| **Document version** | 1.0 |
| **Date** | 2026-06-29 |
| **License posture** | Protocol spec + SDKs: Apache-2.0 on public release. Helix product: proprietary / EULA. |

---

## Abstract

Autonomous agents are moving from single-shot, framework-bound demonstrations to long-running production systems that plan over hours or days, spawn helpers, refine their own instructions, accumulate memory, and coordinate with peers. The tooling ecosystem has not kept pace. The **Model Context Protocol (MCP)** standardizes how an agent reaches a *tool*, and **agent-to-agent protocols** such as **A2A/ACP** standardize how one opaque agent *messages* another — but neither prescribes the *internal lifecycle* of an autonomous worker: how it sleeps and wakes, how it bounds its own risk, how it modifies its own prompt under policy, how it spawns and supervises sub-agents, or how privacy obligations travel with the data it touches. Teams that want these properties build them from scratch, and in doing so re-couple themselves to a single framework's runtime.

This paper introduces the **Agent Execution Protocol (AEP)** — an open, vendor-neutral wire protocol that defines the contract between an **agent runtime** and an **embedder** (any UI, orchestrator, or service that consumes agents). AEP makes long-lived lifecycle, self-modification, self-replication, tree-scoped coordination, learning memory, and GDPR compliance *first-class protocol concerns*, while deliberately composing with MCP at the tool plane rather than replacing it. We present the protocol's concept and design goals, its architecture (JSON-RPC 2.0 over HTTP with SSE event streams, capability negotiation, and a typed resource model), and its self-\* capability surface. We then give an honest, architecture-grounded comparative analysis: rather than claim unverified benchmark wins, we show *which capabilities other approaches structurally lack* and why an AEP-conforming runtime such as Helix can deliver a class of agent behavior that framework-locked and message-layer-only systems cannot express. We close with an evaluation framework, the protocol's spec-grounded operating parameters, current outcomes, and a roadmap.

---

## 1. Introduction

The first wave of LLM agents was *ephemeral*: a prompt, a tool loop, a result, then discard. Production reality is different. A sourcing agent must keep working a candidate pipeline for a week. A monitoring agent must watch a system, sleep, wake on a signal, and act. A research agent must spawn specialists, gather their findings, and synthesize. These behaviors share a set of primitives — persistence, lifecycle control, supervised self-modification, delegation, shared memory, and coordination — that today live *inside* a particular framework's code, not in any portable contract.

The consequence is **lock-in by omission**. If your agents' lifecycle, budgets, constitution, peer-messaging, and learning memory are implemented against CrewAI, AutoGen, LangGraph, or a bespoke runtime, then moving to another stack means rebuilding all of it. The interoperability standards that *do* exist solve adjacent problems: MCP solves tool access; A2A and similar protocols solve inter-agent messaging. The space between them — *the agent's own execution model* — has no open standard.

AEP fills exactly that gap. It is **not** another tool protocol and **not** another message bus. It is the contract that lets:

- a developer build a **conforming runtime** in any stack (Node/TS, Python, Go) that hosts autonomous agents; and
- a developer build an **embedder** (a chat UI, a Slack bot, an ops dashboard, an orchestrator) that drives *any* conforming runtime identically.

Helix is the **reference runtime** for AEP. This paper describes the protocol as the durable artifact and uses Helix to make the abstractions concrete. Throughout, design decisions are quoted from the frozen `aep-2026-04-24` specification.

**Contributions of this paper.** (1) We articulate the *protocol gap* between tool-access and agent-messaging standards. (2) We specify AEP's architecture and self-\* capability model. (3) We provide a capability-matrix comparative analysis that is defensible from architecture alone, with no invented benchmarks. (4) We define an evaluation framework and report the protocol's spec-grounded operating parameters and current outcomes.

---

## 2. Background and Related Work

**Model Context Protocol (MCP).** MCP is an open standard, introduced by Anthropic, for connecting models to external systems. It uses JSON-RPC 2.0 and exposes three primitives — *tools* (model-controlled), *resources* (app-controlled), and *prompts* (user-controlled) — and adds OAuth2-based authorization for tool invocation [1][2]. MCP is the right substrate for *tool access*, and it is explicitly silent on agent lifecycle, autonomy, self-modification, replication, and inter-agent coordination. AEP treats this as a feature, not a deficiency: **AEP composes with MCP at the tool plane** and does not attempt to redefine it.

**Agent-to-agent protocols (A2A, ACP, AGP, ANP).** Google's Agent2Agent (A2A), now stewarded by the Linux Foundation, defines a transport-layer "language" for *opaque* agents to discover one another (via an Agent Card) and exchange Tasks, Messages, and Artifacts over HTTP/JSON/SSE with JSON-RPC [3][4]. These protocols generalize MCP's agent-to-tool relationship to agent-to-agent collaboration. Crucially, they treat each agent as a black box and prescribe *how agents talk*, not *how an agent is governed internally* — its constitution, ceilings, budgets, self-modification policy, or learning memory.

**Agent frameworks.** CrewAI, Microsoft AutoGen, LangGraph, and OpenAI's Swarm provide rich runtimes for building multi-agent systems [5][6][7][8]. They are powerful, but each is a *single-vendor runtime*: the lifecycle and self-\* behavior an application depends on are expressed in that framework's API surface. Portability across them is not a contract; it is a rewrite.

**The gap.** Summarizing: MCP standardizes the *tool plane*; A2A-class protocols standardize the *messaging plane between opaque agents*; frameworks provide *runtimes* but not *interoperable contracts*. None standardizes the **execution model of a single long-lived autonomous agent** — its lifecycle, supervised self-modification, bounded replication, tree-scoped trust, learning memory, and privacy plumbing — in a way that is portable across runtimes. AEP standardizes precisely this, and is MCP-compatible at the tool plane.

---

## 3. Design Concept and Goals

AEP's central concept: **an autonomous agent is a long-lived, governed object with an explicit execution lifecycle, and the runtime↔embedder boundary should be an open contract.**

The specification states six goals (G1–G6) and seven non-goals (NG1–NG7). The goals that shape the architecture:

- **G1/G2 — Portability of both sides.** Anyone can build a conforming runtime *and* anyone can build an embedder that drives any runtime. The protocol is the only coupling.
- **G3 — First-class self-\* with safety boundaries.** Spawning sub-agents, modifying one's own prompt, writing learning memory, and peer messaging are protocol primitives — *but always bounded* by ceilings, budgets, policies, and a trust boundary.
- **G4 — MCP at the tool plane.** Every tool, local or remote, is reached through MCP semantics.
- **G5 — Compliance as a core concern.** A `subject_id` rides with any object that may contain PII; `subject.export / erase / read` are protocol methods, gated by a capability.
- **G6 — Implementable in about a week** for the wire layer by a competent backend engineer.

Equally important are the **deliberate non-goals**, because they are what keep the protocol safe and focused:

- **NG1** — AEP does *not* define agent cognition (how the LLM reasons or plans). It governs the *execution shell*, not the brain.
- **NG4** — Agents **cannot modify their own toolset** at runtime. Tools are declared at creation and are immutable to the agent (an explicit safety veto).
- **NG5** — No cross-tree peer messaging in v1; coordination is confined to a trust boundary (the agent *tree*).
- **NG2/NG3/NG6/NG7** — No hosted multi-tenant runtime, no model/inference selection, no control-plane UI, no mandated retention policy. These are runtime-specific product concerns, kept out of the protocol so the protocol stays small and durable.

This goal/non-goal pairing is the heart of AEP's thesis: **maximal autonomy inside a strict, declarative cage.** The agent may rewrite its prompt, spawn helpers, and accumulate memory — but only within ceilings it cannot raise, under a constitution it cannot fully unlock, inside a tree it cannot escape, using tools it cannot extend.

---

## 4. Architecture

### 4.1 Two roles: Runtime and Embedder

AEP defines exactly two roles.

- A **Runtime** implements AEP and hosts agents. It runs cycles, persists state between cycles, brokers tool calls through MCP, delivers messages, and streams events. *Helix is the reference runtime.*
- An **Embedder** talks to a runtime over AEP: it creates agents, starts runs, and subscribes to event streams. A Helix chat UI, a Slack bot, and an internal ops dashboard are all embedders.

Because the contract is the wire protocol, an embedder written once drives any conforming runtime, and a runtime exposes the same surface to any embedder.

### 4.2 Wire protocol and transport

AEP is intentionally boring on the wire — boring is portable:

- **Transport:** HTTP/1.1 or HTTP/2 (runtime's choice).
- **Requests:** JSON-RPC 2.0, dispatched at a single endpoint `POST /aep/v1/rpc`. Methods are namespaced: `initialize`, `agent.*`, `run.*`, `memory.*`, `message.*`, `subject.*`.
- **Streaming:** Server-Sent Events (SSE) at dedicated paths, e.g. `GET /aep/v1/runs/{run_id}/events`.
- **Binary:** artifact bytes are served directly, e.g. `GET /aep/v1/artifacts/{id}/bytes`, with native MIME types — no third-party storage in the protocol surface.
- **Session:** every request except `initialize` carries `X-AEP-Session-Id: ses_...`; `initialize` is the one method that establishes a session and therefore needs none.
- **Versioning:** calendar-versioned (`aep-YYYY-MM-DD`); every request carries `Agent-Protocol-Version`. A runtime may support several versions concurrently and rejects unknown ones with `version_mismatch`.

Choosing JSON-RPC 2.0 + SSE is deliberate: it is the same family of primitives MCP and A2A use, so AEP slots into existing infrastructure (proxies, gateways, observability) without exotic transport requirements.

### 4.3 Capability negotiation (`initialize`)

A session opens with an `initialize` handshake in which the embedder *requests* a capability set and the runtime *responds* with what it actually supports. v1 defines nine boolean capabilities:

`auth.oauth2`, `compliance.gdpr`, `tools.mcp_external`, `self.modify_prompt`, `self.spawn_subagent`, `self.learning_memory`, `messaging.peer`, `streaming.sse`, and (implicitly required) SSE streaming.

Any attempt to use a capability the runtime did not advertise fails cleanly with `capability_not_supported` (`-32002`). This is what lets a minimal runtime (tool execution only) and a full runtime (self-improving, multi-agent, GDPR-compliant) speak the *same* protocol and degrade predictably. A GDPR-free runtime simply advertises `compliance.gdpr: false` and rejects every `subject.*` call — no guesswork for the embedder.

### 4.4 Typed resource model

AEP defines a small, typed set of resources, each with an opaque, prefixed, URL-safe ID (clients MUST treat IDs as opaque):

| Resource | Prefix | Essence |
|---|---|---|
| **Agent** | `agt_` | A governed worker: constitution, toolset, ceilings, budgets, lifecycle state, tree links, subjects. |
| **Run** | `run_` | One execution session of an agent; emits events; may spawn, call tools, message. |
| **Artifact** | `art_` | A runtime-served file (opaque ID, bytes by URL, sha256, MIME). |
| **Memory record** | `mem_` | Tree-scoped, namespaced, retrievable knowledge the agent writes/reads. |
| **Message** | `msg_` | Tree-scoped async message between agents. |
| **Subject** | `sub_` | A natural person whose PII appears in agent I/O (compliance anchor). |
| **Session** | `ses_` | One embedder↔runtime connection. |

The **Agent** resource is where AEP's philosophy concentrates. Its `constitution` is split into **immutable directives** (creator-set, locked) and a **mutable prompt** governed by a `mutable_prompt_policy` of `auto | approval_required | locked`. Its **ceilings** (`max_cycles`, `max_subagents`, `max_tool_calls_per_cycle`, `max_wall_seconds`) are *hard* limits the agent cannot raise — and notably, a running agent's ceilings may be **shrunk but never widened** (widening returns `lifecycle_conflict`). Its **budgets** (`tokens_per_cycle`, `tool_calls_per_cycle`, `seconds_per_cycle`) are *soft* per-cycle allowances. This declarative cage is the safety contract.

### 4.5 Lifecycle and scheduling

Agents are **long-lived**. They are not created, run once, and discarded; the runtime holds their state between cycles. A *cycle* is one iteration of the thinking loop (an LLM call plus tool calls and state updates), and each cycle ends with exactly one lifecycle decision:

- `sleep(until)` — the runtime wakes the agent at an ISO-8601 time.
- `continue_now()` — wake on the next scheduler tick with *no artificial delay* (distinct from `sleep(until=now)`, which the scheduler may debounce; the spec targets ≤ 1s to the next tick).
- `complete(result)` — the run ends, result is stored, agent returns to idle.
- `spawn_subagent(...)` — create a child and sleep until it completes or messages.
- `send_message(to, body)` — queue a message and yield.

An embedder or timer can force-wake a sleeping run via `run.continue`. Runs emit a causally-ordered event stream (`run.started`, `cycle.started/ended`, `tool.called/returned`, `subagent.spawned`, `prompt.modified`, `memory.written`, `artifact.created`, `error`, …). Events carry a monotonically increasing `event_id` per run and are retained **at least 24 hours** so an embedder can reconnect with `?since=<event_id>` and miss nothing. This is what makes "the agent ran for two days, here's everything it did" a *protocol* guarantee, not a product feature.

### 4.6 Tool plane: MCP as universal substrate

Every tool call — without exception — goes through MCP semantics (`tools/list`, `tools/call`, `resources/read`). The agent sees one uniform tool list regardless of where a tool lives:

- **Path A — in-process modules.** Tools bundled with the runtime, wrapped as a *local in-memory MCP server* at boot. In Helix these are namespaced `helix.*` (e.g. `helix.create_docx`, `helix.web_search`).
- **Path B — external MCP servers.** Attached at `agent.create` via `external_mcp_servers: [{url, auth, name?}]`. The runtime connects, merges the remote tool list into the agent's effective toolset, and routes calls — over standard MCP transport (stdio, HTTP+SSE). This is gated by the `tools.mcp_external` capability.

On every invocation the runtime resolves the tool's source by namespace prefix, applies budget/ceiling/scope checks, and **propagates execution context** (`session_id`, `agent_id`, `run_id`, `subject_id(s)`) to the MCP server via MCP-standard `_meta` so tools can tag their outputs for compliance. Tool metadata carries `requires_subject_id`, `side_effect_class` (`read|write|external`), and `cost_hint` — advisory inputs the runtime uses for budget and retry decisions. Because the substrate is MCP, **the entire existing MCP ecosystem is reachable from any AEP agent**, and AEP adds the governance MCP lacks.

---

## 5. Self-\* Capabilities

AEP's differentiator is that **self-improvement, self-replication, and self-modification are protocol primitives — exposed to the agent as tools, and bounded by the runtime.** When a capability is advertised, the Path-A local MCP server automatically exposes the corresponding tool.

**`spawn_subagent` (self-replication).** Creates a child whose `parent_agent_id = self.id` and `root_agent_id = self.root_agent_id`. The child's ceilings **must not exceed the parent's remaining headroom** (the runtime enforces this), and its toolset must be a subset of the parent's. The parent typically sleeps until the child completes or messages. This makes *bounded* delegation a first-class, supervised operation — depth and breadth of a recursive agent tree are capped by ceilings that compound down the tree.

**`modify_own_prompt` (supervised self-modification).** Edits only the *mutable* half of the constitution, and its effect depends on policy: `auto` applies immediately and emits `prompt.modified`; `approval_required` queues the change (`prompt.change_queued`) for an embedder to approve via `agent.approve_prompt_change`; `locked` rejects with `constitution_policy_violation`. Every accepted edit is appended to an auditable `prompt_history` (diff, reason, approver, timestamp). An agent can *learn how to instruct itself better over time* — without ever being able to escape the immutable directives or the policy gate.

**`learning_memory_*` (self-improvement over time).** `learning_memory_write/read/search` operate on the **tree** namespace (`root_agent_id`-scoped). Agents persist structured, retrievable knowledge — and the whole tree benefits. Optional embeddings enable semantic search where the runtime supports it. This is the substrate for an agent (and its descendants) getting better at a recurring job across runs.

**`send_message` / `inbox_read` (tree-scoped coordination).** Async messaging, strictly within a tree (`to.root_agent_id == self.root_agent_id`; cross-tree is rejected with `tree_boundary_violation`). Delivery is **wake-on-message**: enqueuing to a sleeping recipient schedules its next cycle immediately. Coordination is therefore event-driven, not poll-driven.

**Lifecycle primitives** (`sleep`, `continue_now`, `complete`) are likewise exposed as tools (see §4.5).

**Explicit exclusions (v1):** an agent may **not** modify its own toolset, may **not** modify its own ceilings, and may **not** message across trees. These are the protocol's hard safety rails. The design stance — *autonomy inside a cage* — is what makes self-\* agents deployable in an enterprise rather than merely demonstrable.

---

## 6. Security, Authorization, and Compliance

**Authentication.** Every request carries `Authorization: Bearer <token>`; tokens are opaque to the protocol and bound to a single runtime (the `audience` claim matches the runtime). When `auth.oauth2` is advertised, OAuth 2.1 flows are available, discoverable via `.well-known/oauth-authorization-server`. In Helix, scoped static keys use the `hlx_` prefix.

**Authorization.** A space-separated scope vocabulary binds capability to token: `agent.read/write`, `run.read/create/cancel`, `stream.subscribe`, `memory.read/write`, `tool.invoke`, and the compliance scopes `subject.read/erase/export`. Scopes gate methods; `tool.invoke` is typically issued to agents internally rather than to embedders.

**Compliance as a protocol primitive.** This is a defining choice. Any object that may carry PII has an optional `subject_id` (or many-to-many `subject_ids` on agents and runs). The capability `compliance.gdpr` gates three methods that walk the subject index:

- `subject.export` — a portable JSON bundle of every agent/run/artifact/memory/message record tagged with the subject, plus artifact bytes (data portability).
- `subject.erase` — hard-delete or redact, returning an **erasure manifest** of what was deleted, redacted, stripped-from-list, or retained (e.g. legal hold). For records tagged with multiple subjects, erasing one subject **strips it from the list rather than destroying the shared record**.
- `subject.read` — a DSAR-style read with no side effects.

Privacy-by-design is thus a wire-level contract: an embedder can satisfy a GDPR data-subject request against *any* conforming runtime with `compliance.gdpr` using the same three calls. Most agent stacks treat this as an application afterthought; AEP makes it portable infrastructure.

---

## 7. Comparative Analysis

Honest comparison of an open *protocol* against tool standards, message standards, and framework runtimes cannot rest on invented benchmark numbers — no measured cross-system results exist, and we do not manufacture them. The defensible and, we argue, more important comparison is **architectural: which capabilities each approach can express at all.** The axes below are exactly the primitives AEP's specification establishes.

| Capability axis | **AEP-conforming runtime (e.g. Helix)** | **MCP-only** | **A2A / agent-messaging protocols** | **Single-vendor frameworks** |
|---|---|---|---|---|
| Standardizes tool access | ✅ (composes MCP) | ✅ (its purpose) | ➖ (defers to MCP) | ⚠️ framework-specific |
| Open, vendor-neutral wire contract | ✅ | ✅ | ✅ | ❌ runtime is the lock-in |
| Long-lived agent lifecycle (sleep/wake/continue) | ✅ protocol primitive | ❌ out of scope | ❌ out of scope | ⚠️ in-framework only |
| Hard ceilings + soft budgets as contract | ✅ | ❌ | ❌ | ⚠️ ad-hoc |
| Supervised self-prompt modification (policy-gated) | ✅ | ❌ | ❌ | ⚠️ rare, non-portable |
| Bounded self-replication (`spawn_subagent`, ceiling inheritance) | ✅ | ❌ | ➖ (messaging only) | ⚠️ varies, unbounded |
| Tree-scoped trust boundary | ✅ | ❌ | ⚠️ not a trust model | ⚠️ ad-hoc |
| Learning memory as a primitive | ✅ tree-scoped | ❌ | ❌ | ⚠️ varies |
| Event-driven peer coordination (wake-on-message) | ✅ | ❌ | ✅ (its purpose) | ⚠️ in-framework |
| Resumable, ordered, retained event stream | ✅ (≥24h, `since` cursor) | ➖ | ⚠️ | ⚠️ |
| GDPR `subject_id` + export/erase/read as protocol | ✅ capability-gated | ❌ | ❌ | ❌ app concern |
| Portability of embedder across runtimes | ✅ | ✅ (for tools) | ✅ (for messaging) | ❌ |

Legend: ✅ first-class / by design · ⚠️ possible but non-portable or ad-hoc · ➖ partial / indirect · ❌ out of scope.

**Reading the matrix.** MCP and A2A are *complementary* to AEP, not competitors — they win their own columns (tool access; opaque-agent messaging) and AEP composes with MCP directly. The decisive contrast is with **framework-locked runtimes**: they *can* implement lifecycle, self-modification, replication, and memory, but they do so behind a proprietary API, so none of it is portable, auditable against a common contract, or interoperable with a different embedder. AEP turns those capabilities into an **open contract**, and adds the ones the messaging/tool standards omit entirely: a bounded self-\* model and protocol-level compliance.

**Why an AEP runtime "performs better" — the defensible claim.** Not "faster on a benchmark," but: *it can express a class of agent behavior the alternatives cannot express portably, and it does so inside enforceable safety boundaries.* A long-lived agent that sleeps for a day, wakes on an event, spawns three specialists within inherited ceilings, refines its own prompt under an approval gate, accumulates tree memory, and remains GDPR-erasable — that is a single conforming-runtime program in AEP. In an MCP-only world it is undefined; in an A2A-only world it is undefined; in a framework it is a non-portable, vendor-coupled bespoke build. **Expressiveness within safety, made portable, is the performance win.**

---

## 8. Evaluation Framework and Operating Parameters

Because no cross-system benchmark suite exists, we specify *how AEP should be evaluated* and report the parameters the protocol itself fixes. We recommend three evaluation dimensions for future empirical work:

1. **Conformance.** Does a runtime implement the negotiated capabilities correctly? Measured by a capability-by-capability conformance test suite (planned with the SDKs): every method, every error code, capability gating, tree-boundary enforcement, ceiling shrink/widen rules.
2. **Governance fidelity.** Do ceilings, budgets, and constitution policies *actually* bound the agent? Measured by adversarial runs that attempt to exceed ceilings, widen them mid-run, escape the tree, or bypass the prompt policy — each MUST produce the specified error (`ceiling_exceeded`, `lifecycle_conflict`, `tree_boundary_violation`, `constitution_policy_violation`).
3. **Portability.** Can one embedder drive two independent runtimes unchanged, and can a `subject.export` from one be read by another implementing the same version? This is the protocol's reason to exist and its most important long-term metric.

**Spec-grounded operating parameters** (citable, not invented):

| Parameter | Value | Source |
|---|---|---|
| Protocol version | `aep-2026-04-24` | §5.2 |
| `continue_now` target latency to next tick | ≤ 1s (loaded runtime) | §17 |
| Event-stream minimum retention | ≥ 24 hours | §7.4 |
| Event ordering | causal per run; monotonic `event_id` | §7.4 |
| Identifier length | ≤ 64 chars, opaque, URL-safe | §7.1 |
| Default reference ceilings (illustrative agent) | 500 cycles, 8 sub-agents, 12 tool-calls/cycle, 86,400 wall-seconds | §7.2 |
| Default reference budgets (illustrative agent) | 40,000 tokens/cycle, 6 tool-calls/cycle, 180 s/cycle | §7.2 |
| Running-agent ceiling change | shrink allowed; widen rejected | §7.2 |
| Wire-layer implementation effort (design target) | ~1 week for a competent engineer | §2, G6 |

These are *contractual constants*, not performance measurements — and we are explicit about that distinction precisely so the paper claims nothing it cannot support.

---

## 9. Outcomes and Benefits

What an organization actually gains by adopting AEP:

- **No lock-in by omission.** The lifecycle, self-\*, memory, and compliance logic that today welds you to a framework becomes an open contract. Re-host your agents on a different conforming runtime; keep your embedders.
- **Self-improving agents that are *deployable*, not just demoable.** Prompt self-modification, sub-agent spawning, and learning memory exist — but under ceilings, budgets, policies, and a trust boundary, with a full audit trail (`prompt_history`, event stream). Enterprises can adopt autonomy without surrendering control.
- **Compliance that travels with the data.** `subject_id` propagation plus `export/erase/read` make GDPR DSARs a three-call operation against any conforming runtime — privacy as infrastructure, not an afterthought.
- **The whole MCP ecosystem, governed.** Because the tool plane *is* MCP, every existing and future MCP server is reachable; AEP adds the lifecycle and safety governance MCP intentionally omits.
- **Two SDKs out of the box.** `@aep/sdk-ts` (TypeScript, ESM, Node ≥ 20 / Bun) and `aep-sdk` (Python ≥ 3.11, async) mirror the same surface — `initialize`, `agent.*`, `run.*`, `memory.*`, `message.*`, `subject.*` — with types generated from one canonical JSON-Schema bundle, so the contract and the code never drift.
- **A clean public-release path.** The protocol spec, schemas, and SDKs are slated for Apache-2.0; the Helix product remains proprietary. Adopters get an open standard, not a single vendor's roadmap.

---

## 10. Limitations and Future Work

AEP v1 is deliberately scoped, and we name its edges plainly:

- **No empirical benchmarks yet.** This paper's comparison is architectural. A conformance + governance + portability test suite, and head-to-head latency/throughput studies against framework runtimes, are future work (§8).
- **Single-tree coordination only.** Cross-tree peer messaging and group/broadcast fan-out are deferred past v1; v1 messaging is 1-to-1 within a tree.
- **Cognition is out of scope (NG1).** AEP governs the execution shell, not the planner. Reasoning quality remains a property of the model and the runtime, not the protocol.
- **Cross-runtime *import* is not yet standardized.** v1 defines `subject.export`; a matching import format is targeted for v1.1, as are a protocol-level observability/tracing envelope and possible group messaging.
- **A Go SDK** is gated on TS/Python adoption signal.
- **Open tensions to monitor** during reference implementation include `subject_ids` inheritance on spawn, artifact-bytes auth for very large files (possible signed-URL pattern), and prompt-history growth caps on very long-lived agents.

---

## 11. Conclusion

The agent ecosystem standardized the *tool plane* (MCP) and the *messaging plane* (A2A and peers), then stopped — leaving the *execution model of a single long-lived autonomous agent* trapped inside individual frameworks. AEP closes that gap with an open, vendor-neutral protocol in which lifecycle, supervised self-modification, bounded self-replication, tree-scoped coordination, learning memory, and GDPR compliance are first-class, while MCP is composed at the tool plane rather than replaced. Its guiding principle — **maximal autonomy inside a strict, declarative cage** — is what lets self-improving agents move from demo to production. The honest case for AEP is not a benchmark number; it is *expressiveness within safety, made portable*. Helix is the reference runtime that proves the protocol; the protocol is the durable contribution, and it is built to outlive any single runtime.

---

## References

[1] Anthropic. *Introducing the Model Context Protocol.* https://www.anthropic.com/news/model-context-protocol

[2] Model Context Protocol. *Specification.* https://modelcontextprotocol.io/specification/2025-11-25

[3] a2aproject. *Agent2Agent (A2A) Protocol.* https://github.com/a2aproject/A2A

[4] IBM. *What Is Agent2Agent (A2A) Protocol?* https://www.ibm.com/think/topics/agent2agent-protocol

[5] CrewAI. *Framework for orchestrating role-playing autonomous AI agents.* https://github.com/crewAIInc/crewAI

[6] Microsoft. *AutoGen.* https://github.com/microsoft/autogen

[7] LangChain. *LangGraph.* https://github.com/langchain-ai/langgraph

[8] OpenAI. *Swarm (experimental multi-agent orchestration).* https://github.com/openai/swarm

[9] AEP. *Agent Execution Protocol — Design Specification `aep-2026-04-24`.* (this work; Helix reference runtime.)

---

## Appendix A — v1 Capabilities and Scopes

**Capabilities (negotiated at `initialize`):** `auth.oauth2`, `compliance.gdpr`, `tools.mcp_external`, `self.modify_prompt`, `self.spawn_subagent`, `self.learning_memory`, `messaging.peer`, `streaming.sse`.

**Authorization scopes:** `agent.read`, `agent.write`, `run.read`, `run.create`, `run.cancel`, `stream.subscribe`, `memory.read`, `memory.write`, `tool.invoke`, `subject.read`, `subject.erase`, `subject.export`.

## Appendix B — Error Model (JSON-RPC app codes `-32000`..`-32099`)

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
| -32011 | `lifecycle_conflict` | Operation invalid in current lifecycle state (e.g. widening a running agent's ceilings). |

## Appendix C — Minimal Session (TypeScript SDK)

```ts
import { AEPClient } from "@aep/sdk-ts";

const client = new AEPClient({
  baseUrl: "https://runtime.example.com",
  auth: { bearer: process.env.AEP_TOKEN! }, // Helix issues hlx_-prefixed keys
});

await client.initialize({
  requestedVersions: ["aep-2026-04-24"],
  requestedCapabilities: {
    "self.spawn_subagent": true,
    "self.modify_prompt": true,
    "self.learning_memory": true,
    "compliance.gdpr": true,
  },
});

const agent = await client.agent.create({
  name: "Recruitment researcher",
  constitution: {
    immutable_directives: "Never contact candidates directly. Respect robots.txt.",
    mutable_prompt: "Find senior backend engineers and rank by fit.",
    mutable_prompt_policy: "approval_required",
  },
  toolset: ["helix.web_search", "helix.create_docx"],
  ceilings: { max_cycles: 500, max_subagents: 8, max_tool_calls_per_cycle: 12, max_wall_seconds: 86400 },
  budgets: { tokens_per_cycle: 40000, tool_calls_per_cycle: 6, seconds_per_cycle: 180 },
  subject_ids: ["sub_abc"],
});

const run = await client.run.create({
  agent_id: agent.id,
  goal: "Find 10 senior backend engineers in Berlin with Go + Kubernetes experience",
});

for await (const event of client.run.events(run.id)) {
  console.log(event.type, event); // run.started, cycle.started, tool.called, subagent.spawned, ...
}
```

## Appendix D — Minimal Session (Python SDK)

```python
import os
from aep_sdk import AEPClient

client = AEPClient(
    base_url="https://runtime.example.com",
    auth={"bearer": os.environ["AEP_TOKEN"]},  # Helix issues hlx_-prefixed keys
)

client.initialize(
    requested_versions=["aep-2026-04-24"],
    requested_capabilities={
        "self.spawn_subagent": True,
        "self.modify_prompt": True,
        "self.learning_memory": True,
        "compliance.gdpr": True,
    },
)

agent = client.agent.create(
    name="Recruitment researcher",
    constitution={
        "immutable_directives": "Never contact candidates directly. Respect robots.txt.",
        "mutable_prompt": "Find senior backend engineers and rank by fit.",
        "mutable_prompt_policy": "approval_required",
    },
    toolset=["helix.web_search", "helix.create_docx"],
    ceilings={"max_cycles": 500, "max_subagents": 8, "max_tool_calls_per_cycle": 12, "max_wall_seconds": 86400},
    budgets={"tokens_per_cycle": 40000, "tool_calls_per_cycle": 6, "seconds_per_cycle": 180},
    subject_ids=["sub_abc"],
)

run = client.run.create(
    agent_id=agent.id,
    goal="Find 10 senior backend engineers in Berlin with Go + Kubernetes experience",
)

for event in client.run.events(run.id):
    print(event.type, event)  # run.started, cycle.started, tool.called, subagent.spawned, ...
```

*Both SDKs mirror the same surface — `initialize`, `agent.*`, `run.*`, `memory.*`, `message.*`, `subject.*` — with types generated from one canonical JSON-Schema bundle, so the contract and the code never drift.*
