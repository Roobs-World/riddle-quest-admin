# Multiplayer production rollout — 30 September 2026

Production project: `riddle-quest-ec2b2`. Explicitly authorized in this chat. The backend rollout and active Jest build are verified below. Authenticated sandbox gameplay was subsequently exercised; its coverage and unresolved observations are recorded below. Public listing publication and other provider promotions remain incomplete.

## Completed backend rollout

- Deployed the checked-in Firestore indexes; all ten composite indexes reported READY before the function rollout.
- Deployed 27 selected multiplayer, Reddit gameplay and account-deletion functions using Node 22, followed by the patched dependency lockfile and Firestore rules. Both deployment operations completed successfully.
- Used a compiled staging snapshot with the validated project environment. Excluded the legacy local `.env` containing reserved client Firebase variables; no shared environment file was modified. Required function secrets retain Secret Manager bindings.
- Migration dry-runs scanned 18 challenges and 61 runs with zero unavailable records. Applied 18 archive/projection updates and 16 rules/deadline updates. Verification passes reported zero changes and zero unavailable records.
- Enabled projection reconciliation after backfill. The initial canonical pass examined 18 records and the candidate pass examined eight; both found zero changes and zero unavailable records.
- Compatibility preflight confirms getCurrentClassicRiddle, getCurrentDailyChallenge, submitSinglePlayerGuess, completeGame, getHint, spendCoins and skipRiddle are ACTIVE on Node 22 in the same 30 September deployment cohort (07:52–07:54 UTC).
- Scheduler jobs for deadlines (every minute), projection reconciliation and recovery health (every five minutes) report ENABLED. A final bounded recovery-health observation reports no warnings or pending/quarantined deadline/outbox records.
- Reconciled invocation permissions to the declared public browser boundary for four new callables: findRaceMatch, readyRaceRun, getRaceEntry and cancelRaceInvite. Kept application authentication and App Check enforced; background workers remain private. Live unauthenticated match lookup now returns the expected structured 401 UNAUTHENTICATED response instead of an infrastructure 403.
- Updated transitive dependencies to patched brace-expansion and fast-uri versions. Both workspace security gates pass under the existing policy; the backend npm production audit reports zero high/critical and one moderate advisory. Existing narrowly scoped image-size patch exceptions were preserved.

## Verified Jest release

- Canonical `pnpm release:jest` exited 0, including `verify:production:extended`, the full ten-minute mobile soak and exact-archive browser tests. Security thresholds, coverage requirements, source cleanliness, dependency fingerprints and immutable byte guards remained enforced.
- Source commit: `b9accc17b8c2cf0034f95d36f704ecbfff548c38`, in the isolated release checkout. The shared checkout and branch were preserved; targeted gate repairs were retained there without committing concurrent work.
- Build: `1.0.0-dev.20260930103036.b9accc17b8c2.e16be076`.
- Version ID: `01a0f1f9-5da5-75bf-b420-79ed95bf36de`.
- ZIP SHA-256: `3b36f6c670f02d4b493ac342c1111761f423c7fb0697419925c263d131e243d0`.
- Jest MCP confirms `buildStatus: ready`, `isActive: true`, no processing error, activated at **2026-09-30 11:00:55 UTC**.
- Served HTML and all seven entry assets match the gated local build bytes. A fresh post-activation bounded backend recovery check reports no warnings.
- Acceptance records and the unresolved source barrier were retained. Do not rerun this accepted upload; its exact version is already active.

The gate passed 1,136 portal unit tests, 1,233 backend unit tests, 146 core tests, all 252 emulator tests, all 16 general Jest browser tests, all 59 authentication/multiplayer browser tests and the Facebook, Reddit and YouTube browser suites. The final immutable archive also passed its onboarding/reward, music and 59-test authentication/multiplayer checks. All six HTML5 targets were built during preflight; the subsequent changes repaired release tooling and tests.

Release repairs covered stale React/license and platform-only audit expectations, the injected race deadline authority, missing race-engine boundary coverage, stale publication/empty-pool assertions, authoritative onboarding setup and transient reward-notice timing. Generated dependency inventories now live outside tracked source during release. The credential-bearing rebuild consumes a read-only license inventory captured before credentials are loaded; the package store remains masked. All 26 targeted release/evidence tests and a read-only rebuild passed.

## Live authenticated sandbox verification

The user subsequently supplied a Jest sandbox login. Manual browser verification launched the exact active build using its normal production SDK/backend, without a harness or debug App Check bypass. Startup/onboarding, recorded-human opponent discovery and acceptance, a correct CANDLE answer, the displayed +45-second skip penalty, reload persistence and coin-shop article loading were exercised. A bounded read-only query found one post-activation completed run with position 2 and `skipPenaltyMs: 45000`. Reload preserved authentication, onboarding preference and the displayed 325-coin balance. No purchases or platform chat messages were sent.

This is partial live acceptance, not a pass of the full deployed browser suite. Category choices did not appear after loading. The first Activity request timed out; its retry completed with “No results yet”, so the UI did not demonstrate recovery of this settled recorded race's result. Cloud logs recorded a 12.37-second inbox preflight cold start and a successful category request taking 4 seconds. Browser logs recorded race-operation latency warnings, an analytics persistence warning, Jest host player-state write errors and the Sentry stream configuration warning. The default desktop phone preview also rendered the classic riddle in cramped columns and rejected scaled-frame automation clicks; a taller viewport allowed navigation. These observations require follow-up before claiming complete live acceptance. Two-user invitations/referrals, purchases and a complete ten-answer creator race were not tested.

## Remaining platform boundaries

- Jest MCP still reports unpublished, not in review and rejected. Build activation does not publish or approve the listing. The unauthenticated public route returned “Game not live yet”; authenticated sandbox verification is recorded above. Public release needs the Developer Console review/publication workflow.
- Facebook's canonical command completed its immutable local Draft handoff. SHA-256: `833c89f238224b339b721ed85b0b8640f01972ccd3f8a0166b3bebbcf4dfa71a`. No Meta upload or production promotion occurred.
- Reddit's canonical candidate command stopped on missing authentic contract captures for auth, payment, refund, post-entry, realtime and notification. No capture was fabricated. Remote ingestion/promotion additionally remains blocked until an exact-byte Devvit adapter or equivalent authoritative proof is available.
- Self-contained candidate targets were built, not remotely published.

## Retained evidence

Chat work directory: `/home/craig-beswetherick/Documents/Codex/2026-09-29/come/work`.

- `production-jest-release-complete.log`: successful canonical gate, exact-archive checks and accepted upload.
- `production-jest-activation-verification.json`: authoritative active-version facts and served entry asset hashes.
- `production-jest-live-sandbox-verification.json`, `production-jest-live-run-observation.json` and live screenshots: partial authenticated sandbox coverage and unresolved observations.
- `production-recovery-health-after-client.json`: post-activation bounded recovery health.
- `production-security-patched-functions-deploy.log`, `production-functions-compatibility-state.json`: backend deployment and reviewed single-player cohort.
- `production-{challenges,runs}-migration-{dryrun,apply,verify}.json`: bounded migration evidence.
- `production-facebook-handoff.log`, `production-reddit-handoff.log`: provider handoff outcomes.
- `production-frozen-license-tests.log`, `production-readonly-build.log`: focused release-input verification.

Dependency patch versions were checked against the maintainer advisories: [brace-expansion](https://github.com/advisories/GHSA-qhr7-859c-m2p7), [quadratic expansion](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) and [fast-uri](https://github.com/advisories/GHSA-58mr-gqgx-xq4g).
