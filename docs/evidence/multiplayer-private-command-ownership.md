# Multiplayer private command ownership

The ongoing multiplayer edge-case and reliability audit remains active.

## Reproduction and change

Run-scoped commands previously took identifiers from the displayed snapshot.
Response validation also compared role, category and challenge context against
that mutable object. A retained rendering reference could redirect a read toward
another run, poison canonical recovery, or make a matching changed response pass.
Nine of ten initial regression cases failed before the fix; the locale recovery
control already passed because locale was independently bound to the entry.

Two additional mutation-retry cases demonstrated that a displayed run-ID change
could suppress publication eligibility or lose original quit/publication retry
receipts. Three further cases cover confirmed pointer cleanup on reset/close and
persistence under a synchronous state observer.

Run-scoped transport now binds run and question identifiers to privately confirmed
authority before pending-state notification. Cold-entry resume retains its explicit
saved selection until authority is accepted. Response identity uses the private
run contract, not retained rendering metadata. Retry receipts, publication
eligibility, saved-pointer writes and close/rematch cleanup retain confirmed run
identity. Rematch selection retains the confirmed challenge/fallback context.
Cleanup remains conditional on the expected run, protecting a newer tab's pointer.
Authority diagnostic normalization lives beside command/response validation; the
coordinator remains within its source-size cap.

## Verification

Fifteen public-session cases cover six canonical identity recoveries, four changed
responses matching edited metadata, original abandonment/publication retry
receipts, two cleanup paths and observer-time persistence. The full client race
suite passes 558 tests across 47 suites. Portal typing, source-size and declaration
checks pass.

Twenty injected desktop/mobile browser journeys edit a retained run ID, role,
category, locale or challenge context. Every posted resume selects the original
run. Canonical reads restore all identity fields and the account-bound localStorage
pointer. Matching changed responses are rejected, and the actual Retry button
recovers canonical authority. No new start, guess, hint or skip mutation occurs.
No browser exceptions occurred. The 390px run-ID recovery screenshot was visually
inspected. No product text or locale keys changed.

`docs/development-tasks/race-private-command-ownership.json` adds these browser
journeys to the twenty retained backend/core/client, typing, security, isolation,
seven-platform build and browser gates. Completion requires twenty-two successful
checks including pending-answer recovery, current artifact hashes and an unchanged source digest before the local
dashboard can record the task.

This batch does not commit, push, upload, activate or publish Jest, dispatch release
workflows, deploy Firebase Functions or send messages to other chats. Jest
activation remains authorized with publication held; Firebase Functions deployment
is separately authorized. The overall multiplayer reliability objective remains
active.

## Shared-source completion recording

All twenty-one commands passed in `full-validation.log`, `stable-validation.log`
and `latest-validation.log` under `artifacts/race-command-ownership/`. Each run
correctly refused completion because shared source changed during verification;
no completion receipt or task dashboard row was recorded. The source-digest guard
was retained unchanged.

The independently captured baseline and `source-changes.json` identify the third
window's changes as `docs/facebook-instant-games-operations.md`,
`packages/portal/src/facebook/__tests__/facebookBrowser.jest-playwright.test.ts`
and `packages/portal/src/play/__tests__/hostedBrowser.jest-playwright.test.ts`.
Production implementation did not change in that window and HEAD remained
`8dc08e65f3a72f964137e68eff70487eb7bbf700`. Formal dashboard completion remains
pending a stable-source verification run. The ongoing reliability audit can
continue independently of this recording constraint.
