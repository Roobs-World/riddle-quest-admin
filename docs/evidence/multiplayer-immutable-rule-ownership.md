# Multiplayer immutable rule ownership

1 October 2026 local development evidence. Scope is the named HTML5 platform
artifacts; no standalone web/PWA builds, visible copy or locale updates.

## Reproduced failure and correction

Five public-session cases accepted changed recorded rules before correction;
two unchanged-rule controls passed. The schema deliberately permits both older
one-hint rules and the current hint limit, but subsequent owned views could switch
between those individually valid versions. Resume could silently increase or
reduce the hint budget. Readiness could replace rules already accepted during
preparation. Valid paid hint/skip replies could replace the rules before consuming
the original rollback checkpoint.

Ownership validation now compares every recorded rule field against the previous
privately confirmed snapshot. A changed value rejects before checkpoints or public
authority state are consumed. New runs still accept either supported version.
Unchanged rules can acquire their first readiness schedule and can append canonical
progress from other tabs. Rule compatibility permits coexistence of runs rather
than rewriting the contract of an existing attempt.

## Verification

Seven public-session cases cover increasing/decreasing resumed budgets, changed
paid hint/skip contracts, changed readiness rules and unchanged legacy/current
reads. Paid transport corruption is cloned separately from real canonical authority.
Each rejected action restores its original draft and recovers through canonical
resume without issuing a second paid mutation. Readiness retry retains the legacy
rules while accepting the actual fixed schedule.

The existing exhausted one-hint test previously used contradictory availability;
it could pass because initial ownership was rejected rather than because the paid
request was suppressed. Its fixture now sets unavailable hints and explicitly
asserts a valid racing stage with the recorded one-hint rule. Modern and answer-free
legacy variants both prove that no extra hint is dispatched.

The full client race suite passes 507 tests in 40 suites. Portal types and the
declaration audit pass. The actual multiplayer UI is injected at 1280px and 390px
for changed hint/skip rules; malformed snapshots are individually schema-validated.
Four browser journeys verify rejection, exactly one resume, no repeated paid
mutation and no browser errors. The recovered mobile hint screenshot is inspected.

Comprehensive completion uses `docs/development-tasks/race-immutable-rule-ownership.json`.
All 15 backend, client, core, architecture and isolated-artifact gates must pass
against stable source before a receipt updates the local dashboard. Artifact
hashes bind all seven target builds to the completion evidence.

This batch performs no commit, push, upload, activation, publication, workflow
dispatch or deployment. Jest activation is authorized while publication remains
held; Firebase Functions deployment is separately authorized. The comprehensive
multiplayer reliability goal remains active.
