# Single-player journal writer integration checkpoint

The gameplay recovery hook now routes journal reads, writes and deletions through a per-commit writer that compares immutable observed storage bytes before and after acquiring the real lease. Receipt persistence acknowledges a cursor only when the exact admitting lifetime remains active and storage contains the resulting journal. Guess submission copies the retained journal and successor records before appending a request, so a failed write cannot mutate the live retry queue.

## Verified at this checkpoint

- TypeScript passes.
- 98 focused tests in six suites pass.
- Chromium development takeover reproduction: two journeys, 20 checks pass.
- Firefox development released-lease takeover reproduction: two journeys, 20 checks pass.
- Existing Chromium production settlement regression: 16 journeys, 106 checks pass.

Artifacts and exact selected-source hashes are in `artifacts/solo-journal-writer-integration-2026-10-09/`. The takeover harness is the previously demonstrated failing real React/reducer/concrete-storage harness, unchanged for this verification.

## Outstanding work; not a release-ready fix

The Jest production artifact builds but its audit rejects 579415 initial resource bytes against the unchanged 576716.8-byte budget. The synchronous writer integration adds startup resources; do not increase the budget to accommodate it. Other five targets, full client regression and hosted built-artifact checks have not been repeated for this implementation.

A same-scope lifetime replacement must retain the prior immutable storage observation without silently adopting another tab’s record. The current layout effect creates a new writer and needs a regression and design adjustment for existing in-memory journals across commit replacement. Also verify unknown outcomes where storage mutation succeeds but read-back fails; retries must not overwrite an unrelated replacement.

Next work: preserve cursor ownership across remounts, reduce the startup footprint with a safe readiness boundary or a smaller existing-boundary implementation, repeat the browser matrix and full release verification. No deployment, commit or push was performed. The broad improvement goal remains active.

## Replacement-lifetime and read-back contract follow-up

The hook now retains a shared immutable predecessor map across commit lifetimes. Each writer still has its own ownership gate; retired writers cannot read into that shared cursor or mutate storage. An independent tab’s changed bytes remain rejected even after the lease is released. After a successful storage setter/remover returns, the cursor advances before verification read-back, allowing a transient read failure to recover without adopting an unrelated replacement.

Twelve writer contract tests pass, including replacement lifetime, replacement lifetime with other-tab takeover, successful write followed by failed read-back, and successful deletion followed by failed read-back. TypeScript passes. Logs are `journal-writer-remount.log` and `journal-writer-remount-types.log` in the integration artifact directory. These latest changes have not yet received the full browser/build matrix; the prior selected-source hashes and budget measurement describe the previous checkpoint only. Startup budget remains unresolved.

## Deferred initialization follow-up

The concrete adapter writer now loads through a dynamic import. The hook installs it only for the still-current committing owner, advances a revision to rerun recovery and draft effects, and blocks scoped guess submission until the writer is ready. Failed chunk loads retry after five seconds while that exact committed scope remains live; cleanup cancels the owned retry timer. No paid action may be posted or locally previewed without a successful writer save.

Before adding the chunk-failure retry, Chromium production settlement regression passed 16 journeys / 106 checks. That build had 578887 initial resource bytes, 528 fewer than the previous synchronous checkpoint, but still exceeds the unchanged 576716.8-byte startup budget. The chunk-failure retry was subsequently type-checked; it has not received browser coverage yet. Firefox production regression on the preceding synchronous version also passed 16 journeys / 106 checks.

Next: test delayed/rejected writer initialization and cleanup in the real hook, adapt synchronous hook fixtures to await actual module readiness without bypassing admission, reduce the remaining startup overhead, and run complete six-target / Devvit / browser verification. This is ongoing implementation, not a release-ready artifact.

## Initialization ownership verification

The real hook now has four initialization contract cases: delayed readiness retains and eventually delivers the existing paid request; rejected initialization schedules a retry that restores delivery; cleanup before resolution rejects the stale writer; cleanup before retry cancels its timer and even invoking the retained callback cannot restart loading. The retry function checks exact commit and rendered-scope ownership before starting any load. Existing synchronous hook fixtures now await actual writer initialization before running recovery effects.

All 3237 enabled client tests pass across 316 suites (96 tests / 16 browser-gated suites skipped). TypeScript passes. TSDoc passes for 27911 declarations / 1228 files. The initial sandboxed client run failed only the Reddit gateway listener tests with `listen EPERM`; the same complete suite with authorized localhost access passes. Both logs are preserved. No live verification processes remain.

These unit and static checks include the latest retry guard and comments. They do not replace required browser initialization-failure checks, six target builds, startup-budget repair or built-artifact hosted verification. The prior measured deferred build still exceeds the size gate; no budget was raised.
