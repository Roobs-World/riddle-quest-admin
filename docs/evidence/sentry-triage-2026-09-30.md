# Sentry triage — 2026-09-30

## Scope

Inspected all 47 unresolved issues and their latest events in
`roobs-world-limited/riddle-quest` (project ID `4511885926006864`). The CLI's
automatic checkout detection returned an empty result; the previously verified
mapping in `sentry-triage-2026-09-19.md` identified the correct explicit target.
The search used a 3650-day activity window and returned no further pages.

Checked current source, existing tests, and available production evidence before
making changes. No application code was changed or deployed during this triage.
The user authorized resolving issues when tests verify an existing fix.

## Verified existing fixes and Sentry updates

All six issues below were marked resolved in Sentry.

| Issue | Cause and verification |
| --- | --- |
| [1N](https://roobs-world-limited.sentry.io/issues/147767624/), [1H](https://roobs-world-limited.sentry.io/issues/146799046/) | Historical missing startup translation accessor, established in the September 19 triage. Current `JestPlayApp.tsx` uses the translated `ErrorMessages.CHECK_INTERNET_AND_TRY_AGAIN` key. Injected browser startup tests verify timeout presentation, Retry, successful recovery, and absence of uncaught errors. |
| [1R](https://roobs-world-limited.sentry.io/issues/148115294/) | Historical null payload rejected by Facebook's strict empty-object configuration schema. Current client supplies `{}`. All three empty-callable request assertions pass, configuration server tests pass, and the injected Facebook browser verifies the actual serialized request. |
| [1W](https://roobs-world-limited.sentry.io/issues/148177327/) | Latest event's deployed source permitted only RS256. Existing commit `b4837c62` permits ES256 and RS256 and corrects the issuer. Tests verify both algorithms with real cryptographic signatures while rejecting forged signatures, wrong claims, unapproved algorithms, and mismatched state. |
| [1B](https://roobs-world-limited.sentry.io/issues/146712942/) | Previously established missing `blockedRivals.targetUserId` collection-group index. Live index is READY. A read-only production query using that exact collection group and equality field succeeded with a nonexistent test subject; no account deletion was invoked. |
| [2B](https://roobs-world-limited.sentry.io/issues/150364523/) | Production scheduler logs identify a still-building `raceRuns(status, deadlineAtMs)` index, rather than a code defect. The index is now READY. Five recent production scheduler requests at 08:45–08:49 UTC returned HTTP 200, after the last Sentry event at 07:56 UTC. No index was recreated or modified. |

## Remaining issues

All suffixes below have prefix `RIDDLE-QUEST-`. These remain open because their
latest events do not establish a verified fix. Passing unrelated tests was not
treated as sufficient evidence to resolve them.

| Group | Suffixes | Finding / next requirement |
| --- | --- | --- |
| OpenAI billing | 15, 19, 29, 2A | Latest events explicitly contain bounded `code: billing_not_active`, `status: 429`. 15/29/2A came from local content tooling; 19 also occurred in the deployed daily scheduler. Restore billing for the OpenAI project used by `OPENAI_API_KEY`, then verify generation. Do not change the model or weaken quality checks to conceal this failure. |
| Incomplete daily generation | 11 | Latest scheduler diagnostics identify Korean (`ko`) content for September 30, three attempts. Cloud logs correlate the run with the billing failure. Requires successful missing-content generation after billing recovery. |
| OpenAI timeout/transport | 14, 18, 1V, 24, 25, 26, 27, 28 | Latest stack traces reach SDK request/response timeout or transport branches. Four latest events came from local reset tooling. Existing candidate/scheduler retries and fail-closed quality tests pass; this does not prove provider failures are fixed. |
| Race reads/actions | 21, 22, 23, 1J | Latest stacks reach challenge lookup, active-riddle validation, or resume validation. Current engine/storage regression tests pass, but the redacted events do not identify the offending record or prove which historical condition produced the event. Preserve ownership and immutable content checks. |
| Classic content availability | 1T | Latest stack reaches `getCurrentClassicRiddle`. No verified fix for the event-specific content state. |
| Account deletion | 1C | Separate deletion-boundary failure. The verified 1B index fix does not establish this event's cause. |
| Request/identity rejection | 1X, 1Q, 1S, 1P, X, 12, 13 | Stacks reach authentication, signature, body, or deletion-callback validation. Can represent rejected requests; do not weaken validation or mark resolved without reproducing an unintended rejection. |
| Browser startup/App Check | V, 1A, 1Y, 1G, 1E, 1D, W, 17 | SDK identity, initialization, attestation, and transport branches. The missing-accessor fix above does not establish a fix for these separate issues. |
| Purchase/subscription SDK | 16, 1K, 1F | Latest diagnostics identify reconciliation, subscription synchronization, or purchase operations. No event-specific successful reproduction demonstrating a fix. Preserve authoritative and idempotent grants. |
| Referral SDK | 1M, 20, 1Z | Latest stacks reach provider referral sharing. No verified current defect/fix from the redacted events. |
| Browser race guess | Z | Latest context is `play_host/raceGuess`, not the historical configuration-loading context. Do not resolve this group on the basis of the Facebook payload fix. |

## Verification

- 153 backend tests passed across Yahoo OAuth, Facebook configuration and
  notification requests, daily generation/scheduling, OpenAI service, race
  engine/storage, and account-deletion boundary suites.
- 51 portal unit tests passed, including startup, backend adapters, and the
  three empty-object callable request assertions.
- Six injected Jest startup/retry browser cases passed.
- The injected Facebook browser suite passed, including serialized callable
  request verification.
- `pnpm --filter @qwordly/portal build:all-targets` passed with isolated artifact
  audits for Jest, Facebook, Reddit, YouTube (17 locales), Netflix, and Yahoo.
  The command also built GameSnacks.
- Reddit `build:package:from-client` passed, including 31 package-contract tests.
- Production index state, scheduler request statuses, and the blocked-rival
  query were checked read-only.

Local tests verify the existing source fixes; they do not certify that every
client distribution has received them. Remaining provider/network failures
were not suppressed, and no unrelated working-tree changes were edited.
