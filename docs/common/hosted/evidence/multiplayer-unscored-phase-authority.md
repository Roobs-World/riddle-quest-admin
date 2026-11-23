# Multiplayer preparation/countdown authority

Preparation and countdown must expose an untouched first question: zero score,
wall/adjusted time, penalties, attempts, reveals and player events. The first hint
and full attempt allowance remain available. A prepared projection sampled at or
after its known preparation expiry must already be abandoned. Retained preparation
expiry is not a countdown/gameplay deadline; compatible legacy omitted clocks
remain accepted.

## Reproduction and correction

Before correction, the shared schema accepted nonzero score in both unscored
phases and preparation sampled at its expiry (four failing initial cases).
Three public client session cases also accepted fabricated attempts on start,
cold resume and readiness. Both supported storage revisions accepted attempts
in scheduled records (two failing initial cases). These were valid field shapes
with coherent clocks, not unknown statuses or mismatched question identities.

The shared schema now rejects all independent unscored contradictions. Canonical
storage extends its existing untouched-preparation invariant to scheduled records
before refresh can turn a corrupted countdown into active progress. Terminal
scoring and cancellation invariants remain governed by their existing contracts.

A cold invalid saved-run hint intentionally follows the existing category
recovery path and clears that account's hint; it is not treated as a retryable
owned run. Start/readiness rejection retains explicit retry and confirmed facts.
Tests preserve this difference rather than changing recovery policy.

## Verification

The task manifest binds the full backend emulator coverage, all core/client race
checks, types, lint, security/scalability/declaration/size gates, Firebase routing,
and all seven isolated target builds. Completion is recorded by the normal
stable-source receipt only after every gate passes.

Independent schema cases cover score, penalty, adjusted duration, validly shaped
player event, question position, attempts, remaining allowance, hint availability,
reveals and absent question for each unscored phase. Expiry boundaries and
positive legacy/countdown/active cases preserve supported compatibility.
Stored-record cases cover each corruption independently for both revisions.
The first full backend run passed 992 tests and exposed one impossible positive
fixture: its pre-start rejection case retained nine clears from a final-question
template. The fixture now starts at question zero with zero clears; its original
failed-precondition and no-write assertions remain intact.
The next run passed the full backend suite; lint required joining a parameterised
test call across an unexpected newline. Subsequent concurrent dependency updates
made generated third-party notices stale. Notices were regenerated from the
existing current lockfile, preserving the other task's dependency changes, and
all seven standalone artifact build commands then passed before the final gate.
Emulator service tests exercise readiness, resume and guess after the countdown
start: corrupted stored progress must reject before any canonical run, receipt,
economy, settlement queue or performance queue write.

The injected browser verifier renders the real RaceTo10Game at 1280x900 and
390x844. Corrupt initial preparation, corrupt scheduled readiness and expired
preparation each show a recoverable alert without gameplay; explicit retry reaches
an untouched first question without browser errors. Valid host baselines are
schema-checked before deliberately corrupting one field. Browser evidence is in
artifacts/race-unscored; the recovered mobile view was visually inspected.

No UI copy or locale files were changed. These are local verification and dashboard
records. Jest build activation is authorized; game publication/review/listing
changes remain held. This verification does not upload, activate or deploy.
The ongoing multiplayer reliability goal remains active.
