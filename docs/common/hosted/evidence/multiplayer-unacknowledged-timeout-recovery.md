# Multiplayer unacknowledged timeout recovery

1 October 2026 local development evidence. Scope remains named HTML5 platform
artifacts; no standalone web/PWA build, visible copy or locale changes.

## Reproduced reload gap and correction

Three public-session journeys failed before correction, while a newer-tab-pointer
control passed. Authoritative timeout immediately removed the active run hint,
even though the separate outcome read was still pending, had failed, or returned
a malformed result. Closing or reloading then opened categories instead of
independently reconfirming the terminal run and its outcome.

Timed-out runs now retain the same account-bound resume hint as completed runs.
A new mount reads canonical run authority, then confirms its immutable outcome.
The existing acknowledgement/close path clears only that run's hint after outcome
confirmation; closing an unconfirmed result preserves recovery. Terminal timeout
persistence also observes the existing newer-run protection, so an older tab
cannot overwrite another tab's selected run. Abandonment behavior is unchanged.

## Verification

Four public-session cases use a shared browser-equivalent persistence adapter
across real session disposal/remount. Three cover pending, rejected and malformed
outcome delivery, canonical resume/outcome confirmation, one completion effect and
acknowledgement cleanup. One verifies another tab's newer run survives older
outcome acceptance and close. The complete client race suite passes 530 tests in
44 suites. Portal types and the declaration audit pass.

The injected browser harness mounts the actual multiplayer UI with real browser
localStorage. At 1280px and 390px it resumes an active challenger, receives a
canonical timeout, holds/rejects/corrupts the separate outcome delivery, and performs
an actual page reload. Six journeys prove retained account/run ownership, exactly
one resume and one outcome read after reload, zero new game/paid mutations, valid
timeout rendering, and matching-pointer cleanup only after Back to game. No
browser exceptions occurred. The recovered mobile rejected-outcome screenshot
was visually inspected. The adapter transform exposes only the mounted session
for deterministic control; competitive implementation is unchanged in the harness.

`docs/common/development/development-tasks/race-unacknowledged-timeout-recovery.json` declares eighteen
verification gates covering full backend coverage, client/core checks, types,
architecture safeguards, all seven isolated builds and the relevant retained/new
injected browser journeys. A stable-source completion receipt and current artifact
hashes are required before the local dashboard records this task.

This batch performs no commit, push, upload, activation, publication, workflow
dispatch or deployment. Jest activation remains authorized with publication held;
Firebase Functions deployment is separately authorized. The ongoing multiplayer
reliability audit remains active.

## Shared-source recording attempts

The first two full runs stopped on declaration documentation introduced by
concurrent Facebook changes. Documentation-only repairs restored that gate.
Both `artifacts/race-timeout-recovery/stable-validation.log` and
`artifacts/race-timeout-recovery/latest-validation.log` subsequently passed all
eighteen commands, including seven isolated builds, but the recorder refused a
completion receipt because the shared source changed during verification. No
completion was recorded for this task; dashboard completion remains pending a
stable-source run. The verification guard was retained unchanged.
