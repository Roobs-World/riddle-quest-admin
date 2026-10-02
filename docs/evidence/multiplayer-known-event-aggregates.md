# Multiplayer known event aggregate boundaries

1 October 2026 local development evidence. Work remains confined to named HTML5
platform artifacts; no standalone web/PWA build, visible text or locale changes.

## Reproduced contradictions and correction

Six shared-schema cases accepted individually shaped but contradictory events
before correction: score, wall clock and cumulative penalty beyond the containing
run; hint and skip charges absent from their own cumulative penalty; and opponent
playback beyond its fixed finish. Six public-session cases independently reproduced
first-start score/charge/time/opponent contradictions and paid hint/skip events
whose score exceeded the whole run. Temporary removal of the aggregate guards
was scoped and restored in a finally block before final verification.

The shared contract now bounds each known event's score and cumulative penalty
by its containing run, bounds active event wall time by the live clock, and bounds
opponent event adjusted time by its finish. A cumulative event penalty must cover
that event's charge. Invalid initial history cannot establish ownership or save a
run hint; invalid paid acknowledgements leave the original draft/checkpoint intact
and recover through a canonical read without repeating a charge.

These are retained-fact bounds, not reconstructed full history. Empty and sparse
legacy histories remain compatible. Terminal hint/skip penalties can cross a
competitive deadline: their event wall time may exceed the normalized terminal
wall finish. The first regression run caught that distinction, so the wall bound
is applied only to active run views. Existing terminal receipt checks and two new
positive capped-penalty cases remain passing.

## Verification

Fourteen new core cases cover six contradictions and eight valid current, sparse,
paid, terminal, empty, exact-opponent-boundary and capped-penalty variants. Full core
coverage passes 223 tests across 25 suites. The six new public-session tests recover
original selection or canonical paid progress; the full client race suite passes
526 tests across 43 suites. Portal types and declaration auditing pass.

The long-history schema capacity fixture now includes all of its recorded charges
in the containing run total/adjusted clock. Its array capacity assertion remains.
A documentation-only comment supplies the missing declaration description in a
concurrently added backend legacy-grant fixture; backend behavior is unchanged.

The injected real UI rejects contradictory hint/skip event scores at 1280px and
390px, then verifies one resume, one paid command and no browser errors. Four
journeys pass; the recovered mobile skip screenshot was visually inspected. The
new individual charge check also exposed a leftover initial hint event with zero
cumulative charge in the rule/checkpoint harnesses and the new aggregate harness.
Those fixtures now correctly start with empty history and retain all original
mutation, rollback, draft and recovery assertions. Four rule-ownership and twelve
checkpoint-isolation browser journeys are included in comprehensive recording.

`docs/development-tasks/race-known-event-aggregates.json` declares seventeen gates:
full backend/client/core checks, types, architecture safeguards, all seven isolated
builds, new event recovery and both corrected retained browser harnesses. Completion
requires unchanged source and artifact hashes before recording the local dashboard.

This batch performs no commit, push, upload, activation, publication, workflow
dispatch or deployment. Jest activation is authorized with publication held;
Firebase Functions deployment is separately authorized. The full multiplayer
reliability goal remains active.
