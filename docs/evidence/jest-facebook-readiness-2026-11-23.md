# Jest and Facebook readiness, 2026-11-23

## Verified source and upload

[Repair PR #20](https://github.com/Grindhead/riddle-quest/pull/20) merged at
14:54:42 UTC with the exact tested source
`5887d9279b768dd8a5ec055555868eecf1389631`. The `jest` branch and `origin/jest`
advanced to that commit. Its
[PR readiness run](https://github.com/Grindhead/riddle-quest/actions/runs/45180137753)
completed successfully at 14:53 UTC. All six required workspace, backend and
browser jobs passed, along with GitGuardian. The following documentation-only
commit records this evidence without changing the uploaded game source.

The official Jest inventory confirms the English preview is READY and inactive,
with no processing error. Its version is
`1.0.0-dev.20261123145501.5887d9279b76.24302180`, ID
`01a208e7-756d-7345-9610-52641a1dca1d`.

[Exact inactive preview](https://jest.com/g/riddle-q?versionId=01a208e7-756d-7345-9610-52641a1dca1d).

The gated ZIP is 2,626,231 bytes with 91 entries and SHA-256
`278c21d4a7f390162e765bf3a1e825d25710dcd3f86468cc6db8f43b661b8432`.
The exact served artifact's game-owned initial resources total 573,838 bytes,
below the unchanged 576,716.8-byte limit. The controlled local build comparison
measured 573,783 bytes after the fix; that is a separate build measurement.
[Exact preview](https://jest.com/g/riddle-q?versionId=01a208e7-756d-7345-9610-52641a1dca1d).
The upload from clean source has 90 files, 4.12 MB, in a 91-entry, 2.50 MB ZIP.
Its SHA-256 is
`278c21d4a7f390162e765bf3a1e825d25710dcd3f86468cc6db8f43b661b8432`.
The release command completed successfully; its log is `/tmp/rq-5887-jest-upload.log`.

Work is limited to Jest, Facebook and their shared backend. The Jest build contains
English only. No build was activated, published or submitted for review. Production
deployment remains separate.

## Verification

| Check on source `5887d9279` | Observed result |
| --- | --- |
| Shared/web coverage | 4,048 tests passed |
| Jest SDK adapter coverage | 100% of 186 statements, 118 branches, 49 functions and 166 lines |
| Release and architecture checks | 242 release checks and 55 architecture checks passed |
| Node 22 compatibility | 147 suites and 1,997 tests passed on Node 22.23.1, including types and ESLint |
| Full backend coverage | 246 suites and 3,389 tests passed; statements 89.64%, branches 85.07%, functions 89.06%, lines 91.60% |
| TSDoc | 32,510 declarations across 1,473 files passed |
| Jest artifact | 90 files, 4.12 MB; measured entry 573,783 bytes under the unchanged 576,716.8-byte limit |
| Facebook artifact | 411 files, 4.55 MB; strict artifact audit passed |
| Restore browser checks | Three authentication cases passed after the parser change on runtime-equivalent source `065126469` |
| Browser plan | All four jobs passed; 140 real unique commands, 35 per shard, with no duplicates |

Each browser job also passed HTML validation, both upload preflights and Facebook
progress checks. Its rules stage had 95 suites and 1,362 tests. Common stages had
46 authentication cases, 28 retained-race cases, the Facebook case and the
ten-minute mobile soak. These repeated stages are separate from the 140 commands.

The PR workflow intentionally skips its development receipt. The subsequent
[push run](https://github.com/Grindhead/riddle-quest/actions/runs/45199291482)
uses the same source SHA and was still in progress at 15:05:43 UTC. Its receipt is not claimed here.
The earlier `464e4f541` [run](https://github.com/Grindhead/riddle-quest/actions/runs/45172788278)
passed in full, including its Jest/Facebook receipt at 14:08:17 UTC, artifact
`14826610464`.

## Repair behavior

Routine foreground catalog refreshes share the exact account's pending read and
a ten-second freshness window. Hidden pages defer catalog work while receipt
reconciliation and profile publication continue. Explicit refreshes still read
fresh data after purchases and reject older responses. Reconnection, registration
and recovered receipts require fresh entitlement data on return.

Catalog reads retry one exact provider-negative reply within one 15-second budget.
Persistent, unexpected and terminal failures still report. Paid actions remain
single-attempt. Empty, cleared and explicitly unset guest saves return no saved
progress. Returning saves await the same full parser, loaded only when data exists.
The local comparison removed 3,507 entry bytes from the failing 577,290-byte build. Three
empty-storage cases restored the unchanged coverage thresholds. No latency claim
is made. Peer review corrected manual freshness and hidden-event freshness cases.

Background Daily SDK timeouts and DOM response aborts produce warnings during a
candidate attempt. Existing retries remain unchanged. Caller cancellations, other
modes, unexpected errors and exhausted locale generation still report.

## Live checks on the uploaded repair

Both authenticated Firefox sandbox accounts loaded the exact new version with
`lang="en"` and left-to-right layout. Settings had no language selector. Both shops
showed all six coin packs and Premium active. Initial balances A 4,195 and B 4,150
were preserved. Their existing solo profile counters also matched the baseline.

Eight real tab switches at one-second steps produced one product read and one
subscription read per account in the measured windows, 19,729 ms for A and
18,739 ms for B. Within those windows, all catalog reads began while visible. The passive
probe recorded zero negative catalog replies and no uncaught exceptions.

A live Mixed race showed the same ten clues and mirrored opponent progress. B
finished 10/10 while A had 9/10, with matching winner and loser results. B's balance
increased from 4,150 to 4,200; A retained 4,195. After closing results and reloading
the exact preview, those balances and Premium status persisted. A retained three
solo wins and two daily puzzles; B retained zero for both. Both remained English.

No new purchases were made. The probe captured no uncaught exceptions or negative
catalog replies through the race and reloads. The temporary extension, helpers
and probe session storage were removed. The orientation banner was dismissed.
Both tabs remain open, with tab 0 selected.

## Sentry and HTTP observations

The query in Sentry project `riddle-quest`, ID `4511885926006864`, for exact release
`riddle-quest@1.0.0-dev.20261123145501.5887d9279b76.24302180` returned zero groups at
15:00:50 UTC and 15:02:28.330896 UTC. These are bounded observations subject to
Sentry ingestion delay. Historical groups were not marked resolved.

Cloud Logging returned all 44 subscription-sync POST requests between 14:55:00
and 15:02:26 UTC on `syncjestsubscriptions-00050-giw`. Every request returned HTTP
200, with no HTTP 429 and no truncated results. Safe reports are
`/tmp/rq-5887-sentry-final-safe.json`, `/tmp/rq-5887-subscription-http-final-safe.json`
and `/tmp/rq-5887-sdk-probe-{A,B}.json` and `/tmp/rq-5887-served-initial-bytes.json`.

On the earlier `464e4f541` preview, issues 44 and 2E recorded negative catalog
replies shortly before navigation, and issue 45 correlated with HTTP 429 after
rapid focus changes exceeded the existing 30-per-minute IP limit. A passive trace
placed the negative replies 233 ms before parent `pagehide`, then saw successful
reads in the new document. The provider's internal reason remains unknown. The
older `777d59490` issue 1Y in `getPlayerSigned` also remains unexplained because
its details are privacy-redacted. None was suppressed merely because a new build exists.

## Deployed services and release limits

The scheduler remains ACTIVE on Node 22 revision `dailychallengescheduler-00056-kax`,
updated November 22 at 23:06:54 UTC, with a maximum of 20 instances. Subscription
sync remains ACTIVE on Node 22 revision `syncjestsubscriptions-00050-giw`, updated
at 22:54:51 UTC. Its server rate limit is unchanged. The scheduler's 09:02:34 UTC
transport interruption recovered at 09:03:29 UTC in the same HTTP 200 invocation.
The merged repair changes attempt telemetry, not the existing retry policy.

Worker health at 15:02 UTC was HTTP 200 and configured, with worker and automatic
merging enabled at revision `012020b5d`. Production Jest authority is the public
live iframe; preview authority is off and Functions authority is on. Its actual
10:00 UTC paid-work claim opened PR #20 at 10:03:44 UTC. The stale signed base
correctly blocked worker merging. The owner authorized the reviewed integration;
the original deployment, ticket and base guards remain enabled. Paid repair and
PR creation are proven. Sentry-originated webhook delivery remains unverified.
See the [worker runbook](../sentry-worker.md).

The approved worker plan does not automatically deploy Functions or activate Jest.
No backend deployment or Facebook upload occurred. Facebook payment Functions
remain absent and `FACEBOOK_PAYMENTS_WEBHOOK_ENABLED` is off. Meta checkout
acceptance remains unverified. Earlier Facebook proof at `464e4f541` included 82
recovery cases, 150 backend cases with 81 real-HMAC cases, and an isolated demo
ledger run. PR #20 leaves that payment implementation unchanged.

The recorded active Jest baseline remains `1.0.0-dev.20261025-review-complete`, ID
`01a17226-db08-708f-86a1-6733b1fe4824`. The new upload is an inactive preview.

## Verification history

- `012020b5d` passed workspace/backend checks and exposed four browser fixture failures.
- `fd04896b8` fixed readiness, export discovery, modal hit-testing and the fixture clock. `777d59490` added required comments; a later push cancelled its remaining run.
- `fb658bb81` added Facebook payments and restored Facebook-only ads. `464e4f541` fixed contract expectations and recovery, then passed the complete scoped pipeline.
- PR #20 repaired the observed catalog and Daily reporting problems. The lazy parser and three empty-save cases corrected entry size and coverage without relaxing their limits.

Local logs under `/tmp/rq-5887-*`, `/tmp/rq-jest-entry-*` and
`/tmp/rq-jest-empty-save-*` are ephemeral. CI links and the upload fingerprint above
identify the tested source and artifact.
