---
title: "ADR-0006 — Bring-your-own LLM: provider kinds, key custody and agent binding"
description: >-
  Model and inference selection sit outside AEP by design. How Helix nonetheless lets teams run agents on their own provider keys, for cost control, data residency and vendor relationships.
permalink: /decisions/0006-byo-llm-provider-model/
---

# ADR-0006 — BYO-LLM: provider kinds, key custody, and agent binding

- **Status:** Accepted
- **Date:** 2026-06-17
- **Depends on:** [ADR-0002](0002-runtime-embedder-split.md) (NG3),
  [ADR-0004](0004-scoped-api-keys-and-authz.md)

## Context

NG3 keeps model and inference selection **out of the protocol**. That is the
right call for AEP's durability, but it leaves a real product requirement
unanswered: teams want to run agents on their own model keys, for cost control,
data-residency and vendor-relationship reasons.

Since the protocol declines to specify this, it becomes a *runtime* concern —
Helix has to answer it without leaking model selection into the wire format.

## Decision: three provider kinds plus a managed fallback

Rather than enumerate vendors, enumerate **API shapes**. Three cover
essentially the whole market:

| Kind | Covers |
|---|---|
| `openai_compat` | OpenAI, OpenRouter, Perplexity, Grok (xAI), Together, Groq, vLLM, Ollama, or any custom OpenAI-compatible endpoint |
| `anthropic` | Claude models directly |
| `gemini` | Google Gemini |

Plus a **managed fallback**: if no provider is configured, Helix runs on a
managed default, so BYO-LLM is opt-in rather than a setup prerequisite.

Enumerating shapes rather than vendors means a new OpenAI-compatible provider
needs zero code — only a base URL.

## Decision: key custody

Provider keys are encrypted **at rest with AES-256-GCM** — HKDF-derived master
key, per-record IV and auth tag. Only a `••••last4` hint is ever returned from
the API. A plaintext key is never readable back out of the system, including by
its owner.

This is the same redacted-on-read pattern used elsewhere in the runtime: the
write surface and the read surface are different resources.

## Decision: agent binding

An agent selects its provider and model via `runner: { provider_id, model }`.
A provider that is in use **cannot be deleted out from under a running agent** —
deletion is refused while any agent references it, rather than silently falling
back to the managed default mid-run.

## Consequences

- Two scopes were added beyond the protocol's v1 vocabulary — `provider.read`
  and `provider.write` — bringing `lib/aep/authz/scopes.ts` to 14. This is the
  drift recorded in [ADR-0004](0004-scoped-api-keys-and-authz.md): they are
  runtime scopes, not protocol scopes, which is *why* they are absent from
  whitepaper Appendix A. The appendix should say so explicitly rather than
  simply omitting them.
- Because provider config is runtime-local, an agent definition is **not** fully
  portable across runtimes: `runner.provider_id` is meaningful only to the
  runtime that issued it. Portability stops at the model boundary, by design.
