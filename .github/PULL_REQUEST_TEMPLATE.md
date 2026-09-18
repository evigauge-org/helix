## What this changes

<!-- Explain why, not just what. The diff already says what. -->

## Related issue

<!-- Closes #123 -->

## How you verified it

<!-- What did you actually run or click? "CI is green" is not verification. -->

## Checklist

- [ ] I have read [CONTRIBUTING.md](../blob/main/CONTRIBUTING.md)
- [ ] I have accepted the [Contributor Licence Agreement](../blob/main/CLA.md)
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes
- [ ] `npm run build` passes
- [ ] No secrets are committed; any new configuration is in `.env.example` with
      a placeholder value and a comment
- [ ] Schema changes include a Prisma migration

## Protocol and SDK impact

- [ ] This does **not** change the AEP wire protocol
- [ ] This changes the wire protocol, and an ADR in `docs/decisions/` plus an
      agreed issue are linked above
- [ ] This changes something the [client SDKs](https://github.com/evigauge-org/helix-sdk)
      consume, and a matching issue is open there
