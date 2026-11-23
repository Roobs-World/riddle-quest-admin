# Jest release and user route verification — 22 October 2026

The subsequent [amendment record](jest-amendments-2026-10-22.md) tracks reward itemization, accurate human-wait guidance and the latest processed build. This document retains the earlier route baseline and submission evidence.

The user requested project fixes, publication to Jest, testing of available user routes, and a test URL after verification passes. Jest Console sign-in uses `grindheadgames@gmail.com`, correcting the earlier account selection.

## Changes and artifacts

Earlier fixes and dependency audit details are recorded in [project-issue-fixes-2026-10-22.md](../../common/web-game/evidence/project-issue-fixes-2026-10-22.md). Those include the exhausted-attempt purchase-reward guard and the first-win coin-shop tutorial gate.

Route verification additionally found that Jest guests were shown account deletion even though their adapter exposes registration rather than account management. `ProfileModalPage` now hides both the deletion trigger and confirmation when `platformRegistered === false`. Registered players and platforms without this registration signal retain their existing behavior. The regression suite and an independent review verified false, true, and undefined provider states.

Final game artifact:

- Version: `1.0.0-dev.20261022-routes`.
- Jest version ID: `01a160e4-07d9-7408-936a-bb5f0adc8733`.
- ZIP: `artifacts/jest-route-verification-2026-10-22/riddle-quest-jest-verified.zip`.
- ZIP SHA-256: `d9b9d584d274a46786a99a6141bbef41a5984e782c1c6128c86c7dad57908d2d`.
- 419 files in the immutable verification snapshot match the final build byte for byte. The ZIP has 421 entries including directory entries.
- Jest build, target boundaries, all 16 locale inventories, license check, artifact audit and upload preflight passed. The existing dirty workspace was preserved; no commit or backend deployment was performed.
- Jest accepted the upload and reported processing completed with `buildStatus: ready` and no processing error.

## Automated verification

- Core: 40 suites, 436 tests, all passing.
- Firebase: 235 suites, 3,160 tests, all verified passing with no skips. The initial full run passed 229 suites; five stale test fixtures and an invalid demo project identifier were corrected, then all six affected suites passed 148 tests. Final totals replace those six suites once rather than adding duplicate test counts.
- Portal: full unit/component run passed 319 suites and 3,296 tests before the final profile regression additions. The final profile suite passed nine tests, replacing the six original cases and adding three. The final union is 319 suite files and 3,299 distinct cases; this is not represented as a new full-suite run.
- Core, backend and portal together validated 6,895 distinct tests across 594 suite files.
- Broad built-artifact journeys: 75 tests passed before the final profile visibility change. Dedicated checks passed 165 keyboard scenarios, six invitation scenarios, 24 matchmaking cancellation scenarios, public human matching at two viewport sizes, and direct invitation ownership at two viewport sizes.
- Final-artifact profile and authentication: two suites, 52 tests passed. Both explicit guest and registered account-deletion browser regressions passed on the same 419-file immutable artifact. The uploaded ZIP was checked against every file hash in that artifact.
- Navigation enumeration: Daily passed 92 route paths across 22 screens; PvP passed 171 paths across 37 screens. Baseline Classic had one timeout clicking the obsolete guest deletion action. Its final-artifact rerun passed 81 paths across 20 screens, replacing that failed entry. Combined current coverage is 344 route paths, with all three entry verdicts passing and zero unvisited branches. The entire original baseline sweep is not described as passing.
- Complementary browser checks covered every supported locale, Arabic RTL, bundled third-party licenses, unavailable Daily recovery, offline draft preservation through game/settings/multiplayer, and mock-only account deletion.

Detailed machine-readable results, logs, route matrices and screenshots are under `artifacts/jest-route-verification-2026-10-22/{backend,frontend,browser}/`.

## Hosted and platform checks

The previous final security artifact was activated and tested using an existing Jest Sandbox User. Hosted checks exercised onboarding and contextual tutorials, a Daily win, a Classic win, authority-confirmed rewards, progression/reload, settings/audio, help, credits/legal, profile/statistics, coin shop/Premium presentation, genuine sandbox checkout cancellation, public human matchmaking wait/cancel, and private lobby creation/cancel. Cancelled checkout left the balance unchanged. Private lobby briefly displayed a recoverable error before reaching its waiting state; no duplicate action was needed.

The standalone official Jest Simulator passed all 20 applicable Basic Launch checks, all four Fund automated checks, and all five recommended automated checks. This included guest registration, seven D1–D7 notifications scheduled immediately after registration, product purchase and subscription mocks, entitlement suppression, recovered purchase completion, saved player data and referral capture. The server-to-server notification checkbox remained off because this app uses the Jest browser scheduling SDK.

One initial Simulator launch with an automatically seeded incomplete purchase hit a startup timeout. Retry recovered the purchase and loaded successfully; real hosted launch also succeeded. Backend logs were consistent with cold function startup, and idempotent recovery tests passed. This remains a transient startup observation rather than evidence that every first cold launch meets Jest's reviewer-assessed ten-second requirement.

Real money purchases, real subscription cancellation, SMS sending and irreversible real-account deletion were not performed. Commerce completion and destructive deletion were verified through mocks and server tests; hosted checkout cancellation was verified on Jest itself. No provider terms were accepted during checkout.

## Publication state

The corrected upload is processed and active. Connector readback confirmed this exact version and its selection in the draft. Hosted launch and retained account progression succeeded. Hosted registered deletion was opened and cancelled safely. All four leaderboard tabs (XP, wins, streak and multiplayer wins) loaded populated results; next and previous pagination also worked. Initial leaderboard loading took longer on a cold request, while returning to cached pages was immediate.

The final submission-flow Simulator independently passed all 20 applicable automated Basic Launch checks on the corrected version, including the guest deletion affordance being absent and the registered entitlement suppressing repeat subscription offers. Seven days of notifications were scheduled within five seconds of mock registration. The ordinary app review was submitted with notes; the optional Fund application remained unchecked because the user requested publication.

At `2026-10-22T00:07:28.707Z`, Jest accepted the submission by `grindheadgames@gmail.com`. Both Console and connector readback confirmed **In Review**, with `activeVersionId` equal to `01a160e4-07d9-7408-936a-bb5f0adc8733`. The submission revision is `01a11ab6-4000-7069-8c5c-d01e5721ec88`. `game.isPublished` remains false pending Jest approval. Readback evidence is saved as `artifacts/jest-route-verification-2026-10-22/review-status-readback.json`.

Verified test URL: <https://jest.com/g/riddle-q?versionId=01a160e4-07d9-7408-936a-bb5f0adc8733>. It was opened successfully using the existing Jest Sandbox User session. Public unauthenticated availability is not claimed while the app is in review.

Jest requires moderator approval before this initially unpublished game can become public; build activation alone does not constitute publication.

The prior automatic approval rejection blocked opening the submission flow while verification still had unresolved failures. Testing and repairs continued independently. After those failures were resolved, the same Console action succeeded; no alternative submission mechanism was used to bypass that rejection.

## Approval follow-up

A subsequent live check confirmed all 21 uploaded images are processed and have moderation status `pass`, including the selected logo/hero and required `riddle-q-notification` fallback. None are archived, and there are no pending replacements. Console shows both required agreements, version `2026-10-11`, signed by `grindheadgames@gmail.com`. The notification Moderation and Errors views are empty, and the connector reports no SDK error/warning events.

The submitted game itself remains `in_review`, with `approvedAt: null` and `isPublished: false`. The visible historical rejection belongs to the older 8 October version, not a new decision on this build. Only Jest's human reviewers can grant the remaining app approval. No review was withdrawn or replaced during this follow-up.

Team Settings separately shows Stripe payout onboarding as `Not started`; the team's recorded payout method is `manual_wire`. Payout bank setup is separate from the documented publication prerequisites. No bank details or financial settings were changed. The complete approval snapshot and check time are saved in `artifacts/jest-route-verification-2026-10-22/approval-check.json`.
