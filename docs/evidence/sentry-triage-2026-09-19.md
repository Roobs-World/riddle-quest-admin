# Sentry triage — 2026-09-19

## Connection and scope

Sentry MCP was added to the local Codex configuration at
`https://mcp.sentry.dev/mcp` and successfully authenticated with browser OAuth.
The settings-page URL is an account setup page, not the MCP endpoint.

The verified project is `roobs-world-limited/riddle-quest`, ID
`4511885926006864`. The root `.env` contains legacy ID `4511142985203792`;
querying that ID produced no results. Project discovery and the DSN for
`riddle-quest` verified the corrected mapping. The deployed Firebase Functions
configuration already uses the corrected project.

Read-only Sentry queries around 22:12 UTC returned **34 unresolved issues** in
the last **90 days**, across all environments and releases. Both the slug and
corrected ID returned the same count. This is an activity-window result, not an
all-time unresolved count: the MCP search catalog exposes no all-time option.
All 34 issue details/latest events were inspected. No issue was marked resolved.

[Sentry query](https://roobs-world-limited.sentry.io/issues/?project=4511885926006864&query=is%3Aunresolved&statsPeriod=90d)

## Reproduced defects and local changes

| Issues | Evidence | Change and verification |
| --- | --- | --- |
| [1N](https://roobs-world-limited.sentry.io/issues/RIDDLE-QUEST-1N), [1H](https://roobs-world-limited.sentry.io/issues/RIDDLE-QUEST-1H) | Deployed Jest bundles call missing `Errors.CHECK_INTERNET_AND_TRY_AGAIN` while handling SDK initialization timeout, causing an unhandled rejection. | Use existing `ErrorMessages.CHECK_INTERNET_AND_TRY_AGAIN` translation. Injected SDK test reproduced failure before the fix, then verified localized startup error, Retry, and no uncaught browser errors. Five browser startup/retry cases and 29 startup/AppCheck unit tests passed. |
| [1R](https://roobs-world-limited.sentry.io/issues/RIDDLE-QUEST-1R), related [Z](https://roobs-world-limited.sentry.io/issues/RIDDLE-QUEST-Z) | Backend configuration callable rejects input at its strict empty-object schema. Client supplies no argument, serialized by Firebase as `data: null`. Z reports configuration failure in the same second, but no common trace proves correlation. | Configuration and both notification-prompt calls now supply `{}`. Three new payload assertions failed before the change and pass afterward. Browser harness verifies actual serialized `data: {}` with auth and App Check headers. Server's strict validation is preserved. |
| [11](https://roobs-world-limited.sentry.io/issues/RIDDLE-QUEST-11) | 100 occurrences; latest inspected event at 22:02:18 UTC for September 20 content. Aggregate error omitted failed locale IDs and attempt count. | Incomplete-generation error now carries those bounded diagnostics into Sentry. Tests cover propagation and recovery within the existing retry budget. This improves diagnosis; it does not claim to fix upstream generation failures. |

Changes are local and **not deployed**. Production recurrence must be checked
after release before resolving the corresponding Sentry issues.

## Remaining findings

All short issue IDs below have prefix `RIDDLE-QUEST-`.

| Group | Issues | Finding / limitation |
| --- | --- | --- |
| Daily OpenAI operations | 14, 1V, 19, 18, 15 | Generation, blind-solve and review show timeout branches; 15 reaches the SDK internal-server-error branch. Exact status, locale and attempt diagnostics were absent. Existing candidate retries and scheduler retries preserve fail-closed content quality. No root-cause generation defect was established. |
| App Check | V, 1A | Deployed SDK source reaches `throttled` and `fetch-status-error`; actual upstream HTTP status is absent. Attestation remains required. |
| Account deletion/recovery | 1B, 1C, 1D | Firebase logs for 1B identify `FAILED_PRECONDITION`: missing `blockedRivals.targetUserId` ascending collection-group index. The current manifest includes it and a live read confirms it is `READY`. Manifest commit `4111f9c1` followed the September 13 failure. No index mutation is needed. This identifies 1B's historical cause; it does not prove identical causes for 1C/1D. |
| Purchases/sharing | 1K, 1F, 1M | Subscription synchronization, purchase and referral SDK failures. Redacted payloads do not establish a reproducible current defect. |
| Other startup/transport | 1G, 1E, W, 17, 16 | Includes SDK initialization timeout. The broken timeout presentation is fixed; provider/network failures are not thereby resolved. |
| Bridge validation | Y, T | Need a reproducible rejected message and source contract before changing validation. |
| Request/identity/ownership/progression rejection | 1T, 1S, 1Q, 1P, 1J, X, 12, 13, 10 | May be expected rejection or stale state. Reports alone do not justify weakening validation or server authority. |

The source messages are intentionally redacted and all 15 specifically rechecked
events had no breadcrumbs. Preserve this privacy boundary; use explicit bounded
diagnostics rather than restoring player data or arbitrary error messages.

## Validation

- Portal TypeScript check passed.
- Facebook callable request/response unit suites: 6 tests passed.
- Backend Facebook configuration and notification callable suites: 21 tests passed.
- Daily generation/scheduler/OpenAI suites: 31 tests passed; backend TypeScript,
  changed-file lint, module-cycle audit and build passed.
- OpenAI failure capture now includes existing bounded error class, code and
  HTTP status metadata; a regression verifies request/player fields are excluded.
- Repository TSDoc audit and diff whitespace checks passed.
- Injected Facebook browser harness passed, including actual callable payload.
- Jest injected failure/retry and startup/AppCheck checks passed as above.
- `pnpm --filter @qwordly/portal build:all-targets` passed after the client fixes,
  including target artifact audits. This repository command builds Jest,
  Facebook, Reddit, and the **YouTube fixture**; it does not certify the full
  YouTube release content pack.

## Recurring worker

The worker is **not running**. Subsequent browser authorization verified the
CLI account `grindheadgames@gmail.com` and its Pro team
`craig-beswethericks-projects-d44935d2`. The Sentry API token now passes project
and issue read checks; it and the webhook secret are stored as sensitive Vercel
production variables. The GitHub token is present and authenticates as Grindhead,
but repository and pull-request access return HTTP 404; access correction is pending.
A setup-only webhook endpoint is now deployed at
`https://riddle-quest-sentry-worker.vercel.app/api/sentry-webhook`; GET/HEAD are
reachable and POST explicitly returns 503 until processing is configured.
A local credential wizard was
prepared at `/tmp/setup-riddle-sentry-credentials.sh` with hidden input; it writes
only the requested tokens into the ignored root `.env`.

See [worker setup status and design](../sentry-worker.md). Desktop MCP OAuth is
working, but it is not the deployed server's machine credential.
