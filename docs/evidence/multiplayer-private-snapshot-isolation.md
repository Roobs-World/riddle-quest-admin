# Multiplayer private confirmed snapshot isolation

1 October 2026 local development evidence. Scope remains named HTML5 platform
artifacts; no standalone web/PWA builds, visible strings or locale changes.

## Reproduced aliasing and correction

Six public-session cases failed before the correction. The private confirmed
snapshot copied its top-level run and prompt but retained nested references shared
with the public snapshot. Public consumers could edit rules, deck evaluation,
current evaluation, scoring events or confirmed reveals and corrupt the baseline
used to validate the next canonical read. Valid recovery then rejected indefinitely.
Editing public rules to match a changed transport receipt could also make that
otherwise unauthorized replacement appear to preserve the recorded contract.

The merged private confirmed snapshot is now deeply detached with structured
cloning before it is retained. This preserves all optional legacy content and
schedule ownership while isolating nested rules, events, evaluations and reveals.
Public rendering/projection payloads retain their existing shape and mutability;
they do not become authorization for changed private facts. A canonical resume
can replace corrupted public presentation without repeating a guess or charge.
This change protects the private confirmation baseline; it does not claim that
all public snapshots or pending gameplay drafts are frozen.

## Verification

Five cases mutate nested fields obtained directly from the public snapshot after
a real paid hint, then verify valid canonical resume, exact restored authority,
retained input and one original charge. A sixth case proves matching public and
transport rule edits still reject, then verifies canonical recovery. The pre-fix
run was repeated against corrected input setup with the production change restored
in a finally block: all six failed. The complete final client race suite passes
513 tests in 41 suites. Portal types and the declaration audit pass.

The injected browser build exposes the actual mounted session through a harness
transform of its React adapter; competitive implementation and validation are
unmodified. At 1280px and 390px, the real multiplayer UI accepts an initial hint,
types into the remaining slots, mutates public nested rules/answers/events/reveals,
and issues an explicit resume. Ten journeys verify exact canonical restoration,
retained input, no visible error, one resume, zero new gameplay mutations and no
browser exceptions. The recovered mobile reveal case was visually inspected.

Comprehensive recording uses `docs/development-tasks/race-private-snapshot-isolation.json`.
Its 15 gates cover full backend coverage, core/client tests, target routing,
architecture safeguards and all seven isolated builds. Only a stable-source
completion receipt can update the local dashboard and bind artifact hashes.

This batch performs no commit, push, upload, activation, publication, workflow
dispatch or deployment. Jest activation remains authorized with publication held;
Firebase Functions deployment is separately authorized. The multiplayer
reliability audit remains active.
