# Multiplayer saved-run recovery

The reliability audit remains active. This batch extends the unacknowledged-timeout
fix with recovery of the first saved-run read after entry or browser reload.
It supersedes the pending timeout-only completion recording with a combined
nineteen-gate verification of both fixes.

## Reproduction and change

Before the change, a rejected, malformed, wrong-run or expired initial resume
response removed the saved account-bound run hint. Automatic category discovery
then hid the error, and Retry could no longer resume the run. Four negative cases
reproduced this with canonical authority still available. The pre-change regression
run failed five of six cases, including the account-switch preservation assertion;
the deliberate-reset control already passed.

An initial resume retains its requested run ID privately until authority confirms
it. Failed delivery preserves the browser pointer and visible translated error.
Retry issues another read for that same run; it never creates another race or
repeats a gameplay mutation. Disposal removes only the in-memory retry intent, so
reload independently resumes the saved pointer. Account replacement invalidates
that intent. Deliberate category reset, navigation or a new start removes only the
original pointer, leaving any newer run from another tab untouched. Free-form
transport error text is not evidence that an authoritative run no longer exists.

The companion timeout change retains timed-out runs until result acknowledgement;
its pending, rejected and malformed outcome recovery remains covered by the
combined verification. See `multiplayer-unacknowledged-timeout-recovery.md`.

The confirmed-run persistence policy lives in the storage module; the session
retains authority ownership and passes its lifetime guard to the adapter boundary.
Private confirmed-snapshot isolation is owned by the authority module. These
changes keep the coordinator below its maintainability cap without weakening the
newer-tab or re-entry checks.

## Verification

Six public-session cases cover four initial read failures, deliberate reset and
account replacement. Existing unscored/foreign-response tests now require the
same-run read recovery while continuing to reject forged progress and ownership.
The full client race suite passes 536 tests across 45 suites. Portal types and the
declaration audit pass.

Twelve injected desktop/mobile browser journeys use the actual Retry button or an
actual page reload after rejected, malformed or wrong-run responses. They preserve
the real localStorage pointer, recover the canonical run, show no remaining error,
and issue only resume reads. No browser exceptions occurred. The 390px malformed
Retry screenshot was visually inspected. No visible copy or locale keys changed.

`docs/common/development/development-tasks/race-saved-run-recovery.json` adds this browser verification
to the eighteen existing backend, client/core, typing, security, isolation and
browser gates. All seven isolated artifacts and an unchanged source digest must
pass before a completion receipt can update the local dashboard. Concurrent source
changes must continue to invalidate completion recording.

This batch does not commit, push, upload, activate or publish Jest, dispatch release
workflows, or deploy Firebase Functions. Jest activation is authorized with
publication held; Firebase Functions deployment is separately authorized.
