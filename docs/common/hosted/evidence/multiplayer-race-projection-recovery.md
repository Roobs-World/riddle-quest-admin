# Race Projection recovery verification

Date: 30 September 2026. Base revision: `af93f452` with working-source changes.

The RacePlay module now keeps the original receipt time with hint/skip checkpoints,
advances solving time before reanchoring projected views, and restores that receipt
time on rejection. Guess and paid-action confirmations for another run are rejected
before their checkpoints are cleared. Teardown invalidates receipts, projections
and loader work. Returning to category selection uses the same cleanup path so a
delayed outcome cannot reopen the old result or retain the old challenge.

The injected race adapter permits idempotent abandonment of prepared and scheduled
runs. The ghost-result regression now allows countdown time independently of solving
time. A new browser regression injects correctly correlated hint/skip confirmations
with the wrong run ID and verifies restoration of the clue, penalty and solving clock.

Verification commands passed:

- Race module regressions: 13 suites, 74 tests.
- Portal TypeScript checks.
- Seven isolated builds and artifact audits: Jest, Facebook, Reddit, YouTube,
  Netflix, Yahoo and GameSnacks.
- Eight injected browser flows: immediate skip, rejected paid-action recovery,
  ghost completion and category navigation, creator completion, late guess rejection,
  outcome retry, close during delayed preparation, and active-race quitting.
- Final dependency inventory verification for all seven artifacts.
- Maintainable-file size audit and `git diff --check`.

Run the reproducible completion task with:

```sh
pnpm development:complete docs/common/development/development-tasks/race-projection-recovery.json
```

The first complete verification run passed every command, then the recorder rejected
completion because concurrent chats changed the shared working source during the run.
No completion receipt or dashboard success row was recorded by that attempt. Repeat
the task once the checkout is stable to bind verification and artifacts to one source
digest before recording completion. The broader multiplayer plan remains independently
tracked in `docs/common/hosted/multiplayer-architecture-implementation.md`.

The repository-wide TSDoc audit also reports existing undocumented declarations in
other multiplayer/content work; it is not claimed as passed here.

## Opponent replay and startup validation follow-up

Opponent progress now uses the highest eligible cumulative authoritative count,
including skip milestones. The previous replay filtered out skips and could show
an opponent behind until their next correct answer. Reordered or duplicated events
also no longer cause progress to move backwards. Unit regressions cover the exact
penalized skip boundary and restored event order; an injected browser flow verifies
both players at 1/10 after hint and skip advance the local penalty clock.

The Firebase matchmaking adapter loads race response validation alongside the
opponent request. Response validation and retryable failure handling remain covered
by three adapter tests. Loading those schemas eagerly had raised initial Jest
resources to 0.61 MB, above the 0.55 MB budget; the verified build now uses 0.54 MB.
All seven target builds and dependency inventory audits passed, and the new browser
regression passed. Its screenshot is `/tmp/race-ghost-skip-progress.png`.

The completion task above now includes these regressions and the adapter tests.

The expanded browser verification exposed a rendering regression in the new session
adapter: raw authority error text was passed to the translation function. A temporary
outcome failure then triggered the fatal render boundary instead of preserving the
provisional result and offering retry. Race Session now maps unrecognized server and
provider diagnostics to the existing generic race error, while retaining the known
locale mismatch and invalid-response keys. The public-session regression covers
authority and provider failures, preserved translated errors, and clearing errors.
The browser result-retry regression also requires no uncaught page errors.

Paid-action recovery injection now wraps bridge dispatch before any listener consumes
the response. This reliably exercises the wrong-run rollback seam after the session
listener refactor. The isolated recovery test passed with this injection.

The final expanded completion run passed every declared check: race module tests,
matchmaking adapter tests, portal types, all seven isolated target builds, all nine
selected browser flows, and artifact dependency verification. The completion recorder
then withheld the receipt because shared source changed during verification. Locale
updates are also in progress in this checkout. No locale files were changed for these
multiplayer fixes, and no dashboard completion claim was recorded for this run.
