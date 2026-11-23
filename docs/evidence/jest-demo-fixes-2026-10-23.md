# Jest demo fixes, 23 October 2026

The corrected demo is processed, active and In Review as `1.0.0-dev.20261023-demo-fixes`, build `01a16710-85a3-70b5-b5c1-41c9165f5a01`. The pending submission was updated at 05:51:42.739 BST under `grindheadgames@gmail.com`. Review `01a16618-11b9-71bb-9b52-48281a4c80f5` has no approval yet, and the game is not publicly published. The preceding journal build remains available but inactive.

[Open the corrected test build](https://jest.com/g/riddle-q?versionId=01a16710-85a3-70b5-b5c1-41c9165f5a01).

![Corrected version active in Jest review](../../artifacts/demo-fixes-2026-10-23/review-in-review.jpg)

## Reproduced defects and repairs

A healthy purchase-recovery preflight previously took 16.456 seconds while the client deadline was 15 seconds, producing Startup failed before the signed purchase POST. The existing bounded Jest HTTP deadline is now 30 seconds. The ten-second loading heartbeat, request cancellation, explicit timeout overrides, SDK deadlines and grant-before-confirmation ordering are preserved. No automatic retry, backend deployment, capacity or billing change was added. This prevents the demonstrated premature abort; it does not guarantee provider availability or a worst-case startup below ten seconds.

A second defect hid a durable purchase grant whenever Jest confirmation returned an error or threw. The coordinator now returns the server-confirmed balance after reporting that confirmation failure. The provider's incomplete purchase remains recoverable with its original token. It starts no additional checkout and grants no client-calculated coins.

The old immutable artifact passed the successful-confirmation control but failed both error cases: authority held 550 coins while the UI showed 300. All three cases pass on the corrected artifact. The official Simulator independently reproduced the old defect: one mock coin-pack-2 checkout granted 550, but 7,325 remained visible until reload revealed 7,875. On the corrected version, 7,875 appeared before reload and remained 7,875 after reconciliation.

Only two production files differ from the uploaded journal source: `packages/portal/src/jest/backend.ts` and `packages/portal/src/jest/purchases.ts`. Existing workspace changes were preserved. Request-only patches and before/after hashes are retained in the linked startup and purchase records.

## Verification

- Frozen source: 321 unit suites and 3,349 tests pass. The unit invocation intentionally skips 19 browser-gated suites and 129 cases. An initial restricted-sandbox run could not bind the Reddit redirect test servers; that failed log is retained, and the complete run passed with local-server permission.
- Exact immutable uploaded artifact: eight retained browser suites and 79 checks pass in 315.837 seconds, plus three paired purchase-confirmation cases. All 419 artifact hashes and the captured runtime/test sources stayed unchanged. Twelve shared screenshot paths were restored after acceptance.
- Startup boundary: four regressions fail before the deadline repair and pass afterward. They cover 16.456- and 27-second healthy delays, bounded 30-second failure, rejected authority, heartbeat timing, ordering and cleanup. The combined focused source run passes 95 tests; ten supporting browser journeys cover startup failure/retry and stalled SDK operations at two widths.
- Purchase coordinator and hook: 54 focused unit tests pass, including returned/thrown confirmation failures and same-token reconciliation without a second award. Production types, new regression types, TSDoc, target boundaries, locales, licenses and the Jest artifact audit pass. A direct legacy test-file type audit retains the same 27 preexisting diagnostics before and after the patch, with zero new diagnostics; the baseline is independently reconstructed and verified.
- Rapid input: 24 checks on the preceding immutable artifact retained all letters, including same-task and zero-delay physical key delivery. The first-character-only native CUA text injection symptom did not establish a game keyboard defect; no input patch was introduced.

The previous 337-route navigation matrix remains historical evidence for the journal build. It was not rerun or relabeled as a fresh result for this package. Current verification covers the changed startup and purchase boundaries plus the complete retained 79-check acceptance.

## Actual hosted checks

The corrected Preview was opened from Jest Console. It restored the existing PENGUIN question, PEN draft and 5,120-coin wallet. Completing PENGUIN allowed immediate Next to SNAIL; the settled balance became 5,155. Help measured 422 pixels for both client height and scroll height, with Got It visible.

A separate official Simulator confirmation-error session verified the 7,325-to-7,875 correction and unchanged balance after reload. A fresh clean review session then passed all 20 Basic Launch checks: guest data, simulated registration, timely D1-D7 notifications, pending purchase recovery, mock coin checkout and Premium activation. The wallet reached 11,275, Premium active replaced Subscribe, and immediate Reload app restored TOA with the unchanged wallet. No manual Startup failed Retry was needed in these corrected hosted sessions. Controlled regressions establish the slow-start behavior; the Simulator is not treated as a production performance benchmark.

All payments and registration actions in the Simulator were mocks. No real payment, SMS, subscription cancellation, account deletion or legal agreement acceptance occurred. The optional Fund application was explicitly unchecked before updating the review. Human approval remains pending.

## Artifact and records

The ZIP has 419 files and 4,718,419 uncompressed bytes. Initial resources are 575,272 bytes, or 576,644 including HTML conservatively. The existing 4.5 MiB total and 0.55 MiB initial budgets pass without relaxation. ZIP size is 2,877,258 bytes; SHA-256 is `3082ccf315272d8c3b8c1386b59e253b3b2ddc91333f0784fd2bb7f16569f1c7`.

- [Artifact, unit, browser, hosted and release records](../../artifacts/demo-fixes-2026-10-23/)
- [Startup reproduction and repair](../../artifacts/jest-demo-issues-2026-10-23/startup/summary.md)
- [Purchase reproduction, repair and isolated patch](../../artifacts/jest-bll-2026-10-23/purchase-completion/summary.md)
- [Corrected purchase artifact verification](../../artifacts/jest-bll-2026-10-23/purchase-completion-green/verification-summary.json)
- [Frontend input audit](../../artifacts/jest-demo-2026-10-23/frontend/summary.md)
- [Official active/in-review readback](../../artifacts/demo-fixes-2026-10-23/release-summary.json)

The final review screenshot is 8,392 bytes, SHA-256 `85557edd41c954ef3611f576c6cc5de16095a8be3098e3022255bf65ce7ef50f`. Its one-use local transfer saved and verified the file despite the browser blocking the response page; the temporary listener exited.
