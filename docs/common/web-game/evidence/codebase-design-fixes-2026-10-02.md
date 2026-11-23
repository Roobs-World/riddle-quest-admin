# Codebase design fixes — 2 October 2026

## Changes

- `PlayerProjectionPersistence` merges changes in queue order. Each caller receives its own durable result; a rejected write no longer prevents later operations from running. Failed player or preference projections remain dirty until a successful adapter write and flush. Explicit flush and account-deletion drain retry dirty projections, and clear is serialized with other operations.
- Facebook and Reddit consume the persistence module's merged preferences rather than assembling stale copies around asynchronous presence work.
- `GameEngine` rejects guesses while the base budget is exhausted, ignores early/repeated/terminal Continue requests, and ends in loss when no Continue budget exists. Authorization remains outside this local engine.
- `GameSessionCheckpoints` owns restoration, confirmed save projection, duplicate suppression, completion clearing, and background checkpoints. The React hook supplies state and lifecycle signals and applies returned decisions. Checkpoints exclude unconfirmed guesses, hints, and paid Continue progress. Snapshot values are isolated from mutable adapter data, and delayed echoes of saves cannot replace newer input.

This is a focused change to save/restore ownership. The existing single-player retry journal, completion delivery, and message handling retain their interfaces.

## Verification

Evidence is in [`artifacts/codebase-design-fixes-2026-10-02`](../../../../artifacts/codebase-design-fixes-2026-10-02/).

- All six isolated production target builds and their artifact audits pass: Jest, Facebook, Reddit, YouTube, Netflix candidate, and Yahoo candidate. Complete release content was used; fixture gates were not bypassed. Source-map uploads were disabled and dependency evidence was redirected to temporary storage to preserve existing working-tree evidence.
- Core: 28 suites and 255 tests pass.
- Portal: 238 suites and 1,925 tests pass; 104 browser/conditional tests are skipped in the ordinary unit run.
- Checkpoint regressions: 13 tests pass across the checkpoint module, existing projection checks, and hook integration regression.
- `verify-game-checkpoints-browser.mjs` passes at 1280px and 390px with real React effects and injected storage. It checks reload restoration, delayed save echoes, overlapping preference writes, recovery after a transient write failure, and unconfirmed/acknowledged Continue persistence.
- The Facebook injected SDK browser harness passes on the final implementation.
- File-size audit passes; `git diff --check` passes.
- Changed `GameEngine.ts` has 100% statement, branch, function, and line coverage.

## Existing check failures

The broad Jest browser harness times out waiting for a multiplayer achievement popup at `hostedBrowser.jest-playwright.test.ts:768`. The broad Reddit browser harness times out waiting for a matchmaking retry transition at `redditBrowser.jest-playwright.test.ts:649`.

Both failures also reproduce in independent baseline builds. A Vite transform substitutes the pre-fix engine, player persistence, checkpoint hook, and Reddit entry implementations while retaining the rest of the current working tree. The hook's pre-existing pending-guess effect dependency is retained. No working-tree sources were reverted to produce these builds. The first baseline Jest run stopped at an earlier safety-action timing assertion; a second isolated run reproduced the same achievement-popup timeout as the changed build.

The core-wide coverage gate remains below its 100% threshold in untouched `game/index.ts` and `validation/dailyCalendar.ts`. The repository-wide TSDoc audit reports undocumented declarations in pre-existing working-tree changes; none are in the files introduced or edited for these fixes. These checks are recorded as failures rather than reported as passing.
