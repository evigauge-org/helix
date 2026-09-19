---
title: "AEP JSON Schema bundle"
description: >-
  Canonical machine-readable definition of the AEP wire protocol and the source of truth for both client SDKs: the aep-2026-04-24 bundle index, enums, resources, events and the RPC surface.
permalink: /protocol/schemas/
---

# AEP JSON Schema Bundle

Canonical machine-readable definition of the AEP wire protocol. This is the **source of truth** for both SDKs. Do not hand-edit generated types in either SDK — regenerate via their respective codegen scripts.

- `aep-2026-04-24.schema.json` — bundle index, referenced by all codegen
- `enums.schema.json` — capabilities, scopes, error codes, lifecycle states, policies
- `resources.schema.json` — Agent, Run, Artifact, MemoryRecord, Message, Subject, Constitution, Ceilings, Budgets
- `events.schema.json` — RunEvent envelope and per-type payloads
- `rpc.schema.json` — params/result pairs for every JSON-RPC method

See [`docs/AEP-Whitepaper.md`](../../AEP-Whitepaper.md) for the prose specification.
License: Apache-2.0 at public release. Private until then.
