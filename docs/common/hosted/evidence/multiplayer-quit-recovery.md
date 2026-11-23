# Multiplayer quit recovery

30 September 2026; working-source changes based on revision `c34be571`.

Race Session retains the original run-bound receipt after a rejected or malformed
abandonment confirmation. Retry and a repeated Quit action replay the same mutation
so the authority can return its cached abandonment. Prepared runs no longer retry
readiness after a failed quit, and a close request survives failed readiness rather
than scheduling a run the player already requested to leave.

Quit recovery defers local ghost/deadline results until abandonment is confirmed or
the player chooses Keep playing. Confirmed abandonment clears only the exact owned
resume hint, closes once and emits no scored outcome. Keep playing cancels local quit
intent and immediately reads the authority's run state. An active run resumes; an
already-abandoned run returns to the lobby. Temporary read failure retains uncertainty
and retries a read, preventing another abandonment or a premature ghost result.
Disposal, navigation, rematch and account changes invalidate retained mutation receipts.

Public-session regressions cover active/prepared recovery, repeated failure, malformed
run ownership, cancellation intent, account changes, failed readiness and a ghost
deadline passing while quitting. The deadline regression initially produced a local
ghost-win result and requested an outcome despite unresolved abandonment.

The injected browser regression loses the first abandonment confirmation after the
authority has applied it. It exercises countdown Retry and the active-race Quit
dialog, checks identical receipt/run IDs, a cleared resume hint, no scored outcome
or publication, and a clean lobby on reopening. Companion browser checks exercise
withdrawn quit with a failed recovery read, normal quitting, delayed-start close,
publication recovery and ordinary ghost-deadline
guess recovery. Existing translations and target contracts remain unchanged.

Reproduce verification and record progress in the existing local dashboard:

```sh
pnpm development:complete docs/common/development/development-tasks/race-quit-recovery.json
```

The recorder requires a stable source snapshot throughout all checks before issuing
a completion receipt. Remote synchronization requires accepted-revision CI.

The build gate also exposed a concurrent matchmaking failure-handler import that
eagerly loaded race schemas into Jest startup, exceeding its 0.55 MB budget. The
Firebase matchmaking adapter now loads that handler lazily when a lookup fails,
preserving typed failure handling without making it a startup dependency.

Verification passed: 121 race tests, three Firebase matchmaking adapter tests, portal
types, five selected browser tests (including three quit-recovery paths), all seven
isolated builds and artifact dependency checks. The TSDoc and maintainable-file size
audits passed. The prepared quit-recovery screenshot was inspected. Completion
recording still requires a source snapshot that remains stable across the full run;
concurrent changes caused earlier recording attempts to withhold their receipts.
