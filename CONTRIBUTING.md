# Contributing to Helix

Thanks for taking the time. This document covers what you need to know before
opening a pull request.

## Before you start

**You must accept the [Contributor Licence Agreement](CLA.md).** A bot will
comment on your first pull request with the text to post. Merging is blocked
until acceptance is recorded. The short version: you assign copyright in your
contribution to Evigauge Technologies Pvt. Ltd., you keep the right to use your
own work anywhere else, and you get a Certificate of Contribution when your
pull request is merged.

Read it properly before accepting — it is a real agreement, not a formality.

Note that Helix is **source-available, not open source**. Its licence
([LICENSE.md](LICENSE.md)) caps free use at US$1,000,000 annual revenue and
forbids redistributing Helix as a standalone product. That is deliberate, and
it is not up for debate in a pull request. If it makes contributing
unattractive to you, that is a fair call to make — the client SDKs at
[evigauge-org/helix-sdk](https://github.com/evigauge-org/helix-sdk) are
Apache-2.0 and may suit you better.

## Getting set up

```bash
npm install
cp .env.example .env      # DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL
npx prisma migrate deploy && npx prisma generate
npm run dev
```

Features whose API keys you have not set will disable themselves rather than
crash, so you can work on one area without credentials for the rest.

## Before you open a pull request

All four must pass:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

CI runs the same four. Get it green before asking for review.

## Things that will get a pull request sent back

**Changing the AEP wire protocol.** `app/aep/v1` implements a versioned
protocol that external clients depend on. Adding a method, field or header, or
changing the meaning of an existing one, needs an architecture decision record
in `docs/decisions/` and agreement in an issue *first*. A protocol change that
arrives as a surprise in a diff will be closed.

**Breaking the SDKs.** The TypeScript and Python clients live in
[evigauge-org/helix-sdk](https://github.com/evigauge-org/helix-sdk). If your
change alters anything they consume, say so in the pull request and open the
matching issue there.

**Committing secrets.** `.env` is gitignored and must stay that way. Add new
configuration to `.env.example` with a placeholder value and a comment saying
what the variable unlocks — never a real key.

**Unrelated refactoring.** Keep the diff to one concern. A drive-by
reformatting of a file you happened to open makes the change impossible to
review.

**Database changes without a migration.** Schema edits need a Prisma migration
committed alongside them.

## Architecture decision records

Substantial design decisions are recorded in [`docs/decisions/`](docs/decisions/).
If you are proposing something structural, read the existing records first —
several questions you might raise have already been settled there, with the
reasoning and the rejected alternatives written down. If your change makes a new
structural decision, add a record for it.

## Commit messages

Explain why, not what. The diff already says what. If a change is not obvious
six months from now, the commit message is where you prevent the confusion.

## Reporting bugs

Open an issue with what you expected, what happened, and the smallest
reproduction you can manage. A reproduction is worth more than a description.

For anything security-related, do **not** open an issue. See
[SECURITY.md](SECURITY.md).

## Questions

Open a discussion, or email info@evigauge.com.
