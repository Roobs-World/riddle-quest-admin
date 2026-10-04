# Live multiplayer safety delivery recovery — 3 October 2026

This pass continues the multiplayer/single-player reliability, performance, playability, and latency goal. It addresses the live Block/Report panel retaining an unbounded busy lock and accepting responses after its owning seat or transport has changed.

## Reproduced failures

The actual React StrictMode `LiveRaceSafety` component was mounted with controlled, never-settling authority promises. After the existing 10-second live-command budget, both operations still disabled every control and offered no retry. A pending accepted block also invoked its callback and rendered success after the same component received a replacement ticket or transport. A throwing callback marked an already validated block as failed; an asynchronous rejection escaped as an uncaught browser error.

The preserved component baseline SHA-256 is `357126022ac02cf7507669b75a72b9d901fe02b592c6162de7f80e0abd049418`. Baseline browser observations contain 12 mismatches among 22 observations across desktop and phone widths; the baseline run exits nonzero as expected.

## Recovery and authority

Block and Report now use `liveRaceDeliveryDeadline` with the existing 10-second command budget. Expiry releases the local busy gate and exposes the existing translated Retry/error controls. It does not claim rejection, cancellation, or acceptance of server work.

An uncertain report retains its frozen seat, category, and request ID. Retry resends that exact input even if the selected reason has subsequently changed. A new explicit report for a different reason receives a fresh request ID. Block retries preserve the same caller-owned ticket. All success data is validated with the existing strict authority schemas.

A late valid receipt can recover the timeout while its original panel and delivery still own confirmation. It cannot override a pending retry or a newer explicit operation. Late invalid receipts leave the uncertain operation unconfirmed. Late failures are consumed without disturbing newer work.

The outer component gives each ticket/transport pair an independent panel lifetime, so new ownership starts with fresh controls and old responses cannot mask the new opponent or show success in its panel. Retiring that panel aborts only its local wait, removes its timer/listener, and keeps observing the eventual SDK settlement. Normal live-game delivery behavior remains unchanged when no optional signal is supplied.

A canonical block synchronously consumes further block admission before React renders the disabled button. Optional parent callbacks run once, retain their original effect lifetime, and report their own failures without converting an accepted authority receipt into a failed operation. Every user-facing notice reuses an existing translated locale key. No backend mutation, provider SDK, purchase authority, or target boundary changed.

## Verification

Evidence is under `artifacts/game-live-safety-2026-10-03/`:

- Deadline regressions: 21 tests passed, including five new cancellation/cleanup checks. They cover retirement, late SDK fulfillment/rejection, already-aborted waits, and listener cleanup after acceptance/expiry.
- Full portal suite: 275 suites, 2,364 tests passed; 118 opt-in browser tests skipped.
- Actual safety-panel browser harness: all 40 observations passed at 1280 px and 390 px. Additional input assertions prove exact retry payload retention, new categorized-report identity, exclusion of duplicate block admission, and late invalid-receipt rejection. The recovered panel was rendered in the actual race stylesheet context; touch targets fit both viewports and remain at least 44 px high. Screenshots and control geometry/color data were inspected.
- Existing full live-game delivery browser harness passed at both widths: hung join recovery with the same request ID, interactive guesses bypassing a stalled poll, rejection of superseded late snapshots/failures, and reconnect reconciliation of accepted guesses. Observed local fixture command delivery was 117 ms at desktop width and 101 ms at phone width; these are controlled harness observations, not production latency.
- All six production target builds and SDK isolation audits passed. Exact exit codes and durations are in `build-results.json`; runtime source hashes match the tested builds.
- All workspace type checks, script syntax, file-size audit (1,162 source files), final TSDoc audit (23,774 declarations across 1,088 files), and whitespace checks passed. The new browser verifier is registered in the normal game-browser command.

These are injected authority/provider fixtures and do not send actual reports, blocks, or notifications to other players. The shared checkout includes concurrent work from other chats, and suite counts describe the combined tested state. No deployment was performed. Browser verification used Chromium.

The goal remains active. Next, audit `LiveRaceDirectInvite`: its `sendChallenge` call has no bounded wait or ownership guard, so a stalled authenticated server delivery can retain busy controls, and a late acknowledgment may queue the wrong currently displayed challenge. Preserve the recipient/challenge input when reproducing uncertain delivery retries.
