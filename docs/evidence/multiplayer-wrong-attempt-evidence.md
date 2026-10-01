# Multiplayer incorrect attempt confirmation

1 October 2026 local development evidence. Scope remains named HTML5 platform
artifacts; no standalone web/PWA builds, visible text or locale changes.

## Reproduced failure and correction

Three public-session regressions failed before the correction, while two valid
concurrent-progress cases passed. A successful incorrect-answer reply could carry
accurate feedback but reuse the original confirmed attempt count. This was accepted
for the first modern attempt, a later modern attempt and answer-free legacy input.
The general monotonic snapshot check prevented decreasing the count but allowed
this unchanged acknowledgement to consume the submitted checkpoint.

An incorrect, non-skipping confirmation that still exposes the same active question
must now increase its confirmed guesses-used count. The existing schema proves the
matching remaining budget and prevents exhausting an active question. Validation
precedes checkpoint consumption, preserving the submitted answer for recovery.
The comparison uses the privately confirmed view, not optimistic rendering.

A count increase may exceed one when another tab also submits. A view advanced to
a different question is compatible with a later concurrent clear and is not
compared against the old question's budget. Terminal views retain existing clock,
outcome and history checks. Automatic skips retain their separate charge and
transition evidence checks. This guard does not infer a nonexistent wrong-answer
event from the scoring timeline.

## Verification

Five public-session cases prove the three malformed confirmations reject, recover
through one canonical resume without resubmission, and retain valid concurrent
wrong attempts and another-tab clearing. The full client race suite passes 500
tests in 39 suites. An existing draft/hint-merging success fixture now includes
the actual consumed wrong attempt instead of a zero-count success acknowledgement;
its typing, selected-slot and hint assertions remain intact.

The real multiplayer UI is injected at desktop 1280px and mobile 390px for first,
later and legacy attempts. Six journeys reject the unchanged budget, restore the
submitted answer, clear the error through exactly one resume and retain exactly
one submit command, without browser errors. The recovered mobile later-attempt
screenshot was visually inspected. Portal types and the declaration audit pass.

Comprehensive recording uses `docs/development-tasks/race-wrong-attempt-evidence.json`.
Its 15 required checks cover full backend coverage, client and core tests, all seven
isolated artifacts, dependency isolation and architecture safeguards. A completion
receipt binds unchanged source and artifact hashes before updating the dashboard.

This batch performs no commit, push, upload, activation, publication, workflow
dispatch or deployment. Jest activation is authorized while publication remains
held; Firebase Functions deployment is separately authorized. The multiplayer
reliability goal remains active.
