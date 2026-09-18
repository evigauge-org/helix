# Security Policy

## Reporting a vulnerability

**Do not open a public issue for a security vulnerability.**

Report it privately to **info@evigauge.com** with:

- a description of the issue and why you believe it is exploitable,
- the affected version, commit or deployment,
- steps to reproduce, or a proof of concept,
- any suggested mitigation.

You can also use GitHub's private vulnerability reporting on this repository.

## What to expect

| Stage | Target |
|---|---|
| Acknowledgement of your report | 3 working days |
| Initial assessment | 10 working days |
| Fix or mitigation plan communicated | 30 days |

We will keep you informed as the work progresses, and we will credit you in the
advisory when the fix ships unless you ask us not to.

Please give us reasonable time to release a fix before disclosing publicly.

## Scope

Helix handles credentials, delegated OAuth grants and personal data, so we care
particularly about:

- authentication and session handling (`lib/auth.ts`, `app/api/auth`),
- API key scoping and authorisation (`app/aep/v1`, `lib/aep`),
- the OAuth 2.1 authorisation server and consent flow (`app/(authenticated)/oauth`),
- custody of bring-your-own-LLM provider keys (`lib/crypto`),
- GDPR subject export and erasure (`app/api/privacy`, subject services),
- external MCP server invocation, and tool execution sandboxing,
- injection and SSRF reachable through agent tools.

Out of scope: findings that require a compromised host or a malicious
administrator; rate limiting on a local development server; vulnerabilities in
third-party dependencies that are already public, though we are glad to hear
about them so we can bump the pin.

## Running Helix safely

If you deploy Helix yourself, at minimum:

- set a strong, unique `BETTER_AUTH_SECRET` and never reuse it across
  environments,
- keep `DATABASE_URL` and every provider key out of version control — `.env`
  is gitignored, and `.env.example` must only ever contain placeholders,
- serve over TLS, since API keys and OAuth tokens transit in headers,
- scope API keys to the narrowest capability set that works,
- treat agent tool execution as untrusted code execution, and isolate it.

## Supported versions

Helix has not yet reached 1.0. Security fixes land on `main`, and only `main`
is supported.
