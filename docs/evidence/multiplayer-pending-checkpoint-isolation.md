# Multiplayer pending checkpoint isolation

1 October 2026 local development evidence. Scope remains named HTML5 platform
artifacts; no standalone web/PWA builds, visible text or locale updates.

## Reproduced failure and correction

Seven public-session regressions failed before correction. Pending correct-guess,
hint and skip checkpoints retained the original public run by reference and only
copied the outer historical-guess array. Consumers retaining earlier snapshots
could mutate downloaded clues or nested historical guess/feedback arrays after
projection. Rejection restored those edited values instead of the captured
original. A retained original answer reference could also change submitted scoring
validation and reject a genuinely correct authority acknowledgement.

Guess and paid-action checkpoints are now deeply detached when captured. The
original run, submitted letters, receipt anchor, historical guesses, feedback and
paid draft belong to that pending operation independently of public presentation.
The existing confirmed-authority clone remains separate. Checkpoints are released
by the same confirmation, rejection and lifetime teardown paths; explicit recovery
continues to read authority rather than repeat mutations.

## Verification

Six public-session cases mutate retained public run/history references during a
pending guess, hint or skip, reject delivery, and verify exact original rollback,
then canonical read recovery with no repeated action. A seventh case mutates the
retained submitted answer but accepts the actual correct confirmation and keeps
successor input. All seven failed before correction. The final full client race
suite passes 520 tests across 42 suites. Portal types and declaration auditing pass.

Private gameplay tests compare restored values and explicitly verify a detached
run instead of requiring reference identity. Three account-replacement tests now
identify rollback by its original facts, assert full restored equality, and retain
their original replacement-account, timer and later-command assertions. An old
error still cannot escape rollback into a replacement session.

The injected browser harness renders the actual multiplayer UI and exposes its
mounted session through the same test-only React adapter transform used for
confirmed-snapshot isolation. A genuine wrong-answer acknowledgement first creates
historical feedback. At desktop 1280px and mobile 390px, twelve journeys hold a
second guess/hint/skip response, mutate retained public run/history references,
reject delivery, assert exact restored run/history/input, and recover through one
resume without another gameplay mutation. No browser errors occurred. The recovered
mobile guess-history case was visually inspected.

Comprehensive completion is defined in
`docs/development-tasks/race-pending-checkpoint-isolation.json`. Its 15 gates cover
full backend coverage, client/core tests, routing, architecture safeguards and all
seven isolated artifacts. Source stability and artifact hashes must be confirmed
before the local dashboard records completion.

This batch performs no commit, push, upload, activation, publication, workflow
dispatch or deployment. Jest activation remains authorized while publication is
held; Firebase Functions deployment is separately authorized. The multiplayer
reliability audit remains active.

## Concurrent release verification window

Three complete verification attempts passed all fifteen executable checks, but
all correctly refused to issue completion receipts because the shared checkout
changed during execution. Concurrent release work advanced Git HEAD and changed
live verification prose, fallback request coverage/locale fixtures, telemetry
configuration and preparation/scheduling coverage. The presentation change only
removed a redundant active-status conditional inside its already-active branch.
No source-stability exclusion or receipt guard was weakened. Logs remain under
`artifacts/race-checkpoint-isolation/` as `full-validation.log`,
`recording-validation.log` and `stable-recording-validation.log`. Completion and
dashboard recording remain pending a full verification window on stable source.
