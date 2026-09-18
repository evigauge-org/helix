# Changelog

Notable changes to Helix, the reference runtime for the Agent Execution
Protocol. Dates reflect when work landed on `main`.

## 2026-08

- Documentation pass across protocol and product docs.
- Architecture Decision Records introduced under
  [`docs/decisions/`](docs/decisions/README.md).

## 2026-06

- **Adaptive research chain-of-thought.** Accumulating live feed of research
  steps, with expandable steps showing real tool results in both the live and
  persisted views.
- **Backend decoupling.** Removed the Python-backend deep-research query lane,
  the backend research render tree, voice, studio/NotebookLM and RAG routes.
  Replaced the backend `WSProgressMessage` with a local `ResearchProgress`
  type and dropped the `API_URL` / `WS_URL` constants and backend env vars.
- Fixed adaptive-mode gating, single-persist turns, SSE error propagation and
  stream-close guards.

## 2026-05

- **Insurance factsheet pipeline.** `InsuranceFactsheetCache` with inline PDF
  bytes, per-insurer fetch modules, row normaliser and `factsheet_extract`
  tool, plus an auth-gated PDF streaming route.
- **Templates.** India insurance factsheet assistant, additional India
  templates, and per-template reviewer-card renderers.
- Redesigned the agent template gallery cards and toolbar.

## 2026-04

- **AEP v1 frozen** as `aep-2026-04-24`
  ([schema](docs/protocol/schemas/aep-2026-04-24.schema.json)).
- **SDKs.** TypeScript and Python clients over the AEP surface.
- **Security.** Scoped API keys (`hlx_` prefix), OAuth 2.1 capability,
  external MCP server attachment.
- **Compliance.** GDPR subject read / export / erase with erasure manifests.
- **BYO-LLM.** Provider kinds `openai_compat`, `anthropic`, `gemini` plus a
  managed fallback; AES-256-GCM key custody; `runner.byo_llm` SDK capability;
  provider management UI at `/settings/llm-providers`.
- Code history begins 2026-04-07. ADR dates predate the repository and record
  when each decision was taken, not when it was committed.
