# Deferred journal validation checkpoint

The gameplay storage adapter now exposes only writer initialization, guarded receipt persistence and lease operations. Synchronous journal inspection lives in `pendingPlayJournalDiagnostics.ts`; its callers in tests and maintained browser scripts were migrated. The existing structural reader moved unchanged to `readPendingGuessJournal.ts`. Both writer initialization and receipt persistence load it on demand. This prevents static diagnostic access from placing recovery validation in the initial production resource graph.

The first attempted reader extraction retained a static re-export and failed the startup gate at 579160 bytes; separating the diagnostic module corrected that dependency. No validation checks or size budgets were removed.

## Current evidence

- Jest production build and target/locale/license/artifact audits pass.
- Initial resources: 576547 bytes against unchanged 576716.8-byte limit, 169.8 bytes headroom. Previous completed receipt-transition build: 576664 bytes.
- All 3237 enabled client tests across 316 suites pass; 96 tests in 16 browser-gated suites remain skipped.
- TypeScript and TSDoc pass.
- Chromium production settlement harness: 16 journeys, 106 checks pass.
- Firefox production released-lease takeover harness: two journeys, 20 checks pass.

Reports and copied harnesses are in `artifacts/solo-journal-reader-isolation-2026-10-09/`. The copied harnesses use the new diagnostic import; their journey assertions were preserved. An initial harness invocation failed to resolve the removed export before its generated-template import was migrated; the corrected harness runs passed. Archived prior harnesses were not edited.

Four receipt presentation tests initially assumed deferred storage cleanup completed by the router return. They now assert presentation preservation first, await one event-loop turn, and assert durable deletion. The full suite passes after that correction.

Remaining: verify delayed/rejected initialization and remount behavior in real browser harnesses, complete the browser matrix, build the other five targets and Devvit, exercise hosted built-artifact paid actions, freeze source evidence and archive owned build outputs. The passing Jest build is `/tmp/solo-journal-reader-isolated-build/jest` and has not been archived or removed yet. Other probe outputs also remain under their separately owned `/tmp/solo-journal-*-build` directories. All verification jobs from this checkpoint are terminal. No deployment, commit or push occurred; the improvement goal remains active.

## Target and hosted verification follow-up

All remaining Facebook, Reddit, YouTube fixture, Netflix and Yahoo builds pass, as does the Devvit server build. Together with the prior passing Jest build, all six client targets have passed their isolated build gates. Outputs are under `/tmp/solo-journal-reader-isolated-build/`; logs and the exact remaining-build script are in this report’s artifact directory.

The first hosted paid-action run passed 13/14 journeys and timed out waiting for complete journal absence in Skip confirmation recovery. The isolated journey then passed; a complete rerun also passed 14/14. A failure diagnostic was added to the test to report only retained gameplay journal fields, excluding identity and profile. No failing record was captured yet, so the intermittent timeout is unresolved and the green rerun must not be treated as proof that it is fixed. Production source was not changed during these build/test jobs. Test diagnostics were added after build completion. All jobs are terminal.

Next actions: reproduce the intermittent hosted timeout with retained-journal evidence, browser-test initialization delay/rejection and remount cursor transfer, finish the engine/mode matrix, recheck the final test-source/static gates, freeze the source manifest and archive owned build outputs.

## Hosted timeout diagnosis and completed settlement matrix

A complete hosted rerun reproduced both Skip confirmation and reload timeouts. Failure diagnostics captured exactly a root index-1 journal, empty queue, empty root draft, successor index 2, and no paid action or preview marker (`hosted-paid-actions-repeat-2.log`). This proves the paid work had settled and the retained journal represented the successor gameplay draft. The old test incorrectly required deleting every recovery record.

The recovery-loop assertion now requires every retained Skip journal to have zero queued guesses and no coin action or preview ownership. Hint retains its original full-deletion assertion. Existing displayed-successor, duplicate-delivery rejection and exactly-one-paid-request checks remain. The corrected complete hosted run passes 14/14 journeys. The temporary stderr diagnostic was removed after preserving the failing-state log. Production source was unchanged by this assertion correction.

The final settlement harness now passes Chromium and Firefox in development and production: 16 journeys / 106 checks for each combination, 64 journeys / 424 checks total. Final TypeScript and TSDoc pass (27913 declarations / 1230 files). This resolves the captured hosted timeout; it does not substitute for pending real-browser initialization-delay/failure and replacement-lifetime cursor-transfer coverage. All jobs from this follow-up are terminal.

## Real-browser initialization ownership and readiness fix

A derived real React/router/reducer/concrete-storage harness holds writer initialization at the adapter promise boundary. Eight journeys at widths 390 and 1280 cover delayed initialization, rejected initialization followed by retry, retirement before resolution, and retirement before a retained cancelled retry callback. Strict Mode also installs and revokes the first initialization owner. The actual concrete factory is called when the controlled promise resolves; no fake persistence writer replaces it. This verifies initialization ownership but does not simulate HTTP module-fetch failures themselves.

Before the UI fix, Chromium production reported exactly eight failures: `coinActionsReady` was true while initialization was held. Charges and delivery were already safely blocked. Paid readiness now additionally requires the installed journal writer, preventing controls from presenting premature availability. After the one-line production fix, Chromium production and Firefox development each pass eight journeys / 42 checks, 84 checks total. TypeScript passes. Diagnostic and fixed reports and screenshots are preserved in this artifact directory.

The preceding six-target builds, startup measurement, settlement matrix and full client tests describe production source before this latest readiness change. They must be repeated or reconciled appropriately before completion. Replacement-lifetime cursor-transfer browser coverage, remaining initialization combinations, final manifests and build-output archival remain outstanding. All jobs from this follow-up are terminal.

## Replacement browser coverage and final artifact rebuild

A new derived harness changes the host callback within the same mounted hook and account scope, forcing cleanup and replacement of its committed delivery lifetime. Existing local journal and observed bytes remain in memory. Chromium production and Firefox development each pass four journeys / ten checks: the replacement writer saves its own successor draft; after a second tab writes a different paid request and draft then releases its real lease, the replacement writer preserves both. This exercises the actual React hook, actual factory, actual durable lease and exact journal bytes.

After the readiness UI fix, all six client builds and the Devvit server build pass again under `/tmp/solo-journal-writer-final-builds-20261009/`. The final hosted built-Jest paid-action test passes 14/14. All 3237 enabled client tests pass; TypeScript, TSDoc and maintainable-file size audit (1307 files) pass. The final initial resource set is 576558 bytes against 576716.8 budget, 158.8 bytes headroom. Selected source manifests verify 2561 inputs unchanged before and after builds. No active verification jobs remain.

Outstanding for this fix: complete the initialization/replacement engine/mode combinations and recheck the settlement/takeover matrix against the final readiness revision, verify terminal source manifest, archive final build inventories and clean only the owned temporary output roots. The broad reliability/performance/playability goal remains active beyond this single journal fix.

## Verified completion of this journal fix

The final review packet is `verified-summary.json`: 120 local browser journeys / 712 checks across both engines and React modes cover receipt settlement, active takeover, initialization delay/rejection/retry/retirement, and same-scope commit replacement. Released-lease takeover is additionally verified in the dedicated browser and writer contract tests. All datasets pass. Four final initialization/replacement combinations reused reports already run on the identical final production source; no intervening production changes occurred. The final source manifests match all 2561 selected inputs.

The final built-app paid-action suite passes all 14 journeys. All 3237 enabled client tests, types, TSDoc, file-size audit, six isolated client builds and Devvit build pass. Startup is 576558 bytes, leaving 158.8 bytes under the unchanged gate. The screenshot of the 390px Firefox delayed-initialization fixture was inspected; its real game board and keyboard remain rendered while the loader ownership checks run. Fixture controls are diagnostic UI, not shipped product changes.

1316 final build files were archived byte-for-byte with SHA-256 hashes and six dependency inventories. The owned final build root was removed. Four separately owned probe build roots were removed, and their nine remaining inventories were archived. Other worktrees, shared outputs and unrelated artifacts were untouched. All verification jobs are terminal. No commit, push, deployment, live provider purchase or cloud latency claim was made.

This completes the reproduced stale-tab journal overwrite fix and its initialization readiness adjustment. The broader multiplayer/single-player reliability, performance, playability and latency goal remains active. Follow-up audits should target other evidence-backed risks rather than repeating this completed matrix without a new change or failure.
