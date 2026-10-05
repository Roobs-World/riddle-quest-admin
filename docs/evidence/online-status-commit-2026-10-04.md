# Browser connectivity across first mount

The game frame, startup recovery, and save recovery now reconcile the current browser connectivity snapshot when subscribing. A connection change between render and subscription no longer leaves an offline alert missing or Retry permanently disabled until another event arrives.

## Diagnosis

The real `BridgeStartupRecovery` reproduced a reconnect event arriving during parent layout: `navigator.onLine` was true while Retry remained disabled. The minimized command failed 1 of 4 assertions on two runs. Delaying the same event until two animation frames passed all 4; leaving the initial connection unchanged also passed all 4.

The ranked hypotheses were missed event registration, disagreement between event and browser snapshot, and another pending action blocking Retry. The snapshot read was already true, no reload had been requested, and a delayed identical signal enabled the button. Moving only registration into the layout phase passed the parent-event probe (60 assertions), but a single signal emitted by an earlier sibling still failed 1 of 4. The sibling fixture explicitly emits once: an initial emitter replayed in StrictMode and masked the layout-only gap, so that diagnostic was corrected before selecting the final mechanism.

`useOnlineStatus` now uses `useSyncExternalStore` with stable module-level subscription and snapshot functions. React checks the browser snapshot across render/commit/subscription and on ordinary online/offline events. A local subscription lifetime prevents removed callbacks from notifying the retired consumer. The same snapshot getter preserves the existing server-render behavior; all 4 existing game-frame server-render tests passed. The dependency/subscription identities remain stable across ordinary consumer updates.

## Regression seam and result

`verify-online-status-commit-browser.mjs` mounts actual `GameFrameApp`, `BridgeStartupRecovery`, and `PlayerSaveRecoveryLayout` consumers in StrictMode. It emits disconnect/reconnect from either parent layout or an earlier sibling, checks the visible consumer after settling, performs 32 native parent updates without subscription churn, checks ordinary browser signals, and verifies listener cleanup after retirement. Save presentation uses the valid `unsaved` snapshot and an injected target wake; startup reload is explicitly injected so the test does not navigate the real document.

Positive action checks verify one native startup reload with repeated activation excluded, target-owned save wake, and navigable Settings after reconnect. Three viewport sizes (390×568, 390×844, 1280×844) and both React modes cover 72 journeys. The final verifier passed 402 assertions per mode, 804 total. The captured original hook failed 72 of 402. A supplementary omitted-event probe passed 48 assertions, confirming snapshot reconciliation after the signal has already passed.

Run the focused reproduction from `packages/portal`:

```sh
ONLINE_COMMIT_BASELINE_DIR=../../artifacts/online-status-commit-2026-10-04 ONLINE_COMMIT_QUICK=1 ONLINE_COMMIT_SURFACES=bridge ONLINE_COMMIT_SCENARIOS=reconnect ONLINE_COMMIT_SMOKE=1 ONLINE_COMMIT_REPORT_DIR=../../artifacts/online-status-commit-2026-10-04/final-minimal-original node scripts/verify-online-status-commit-browser.mjs
```

The frozen command exits 1 with the original hook (1 failure in 4 assertions); omitting `ONLINE_COMMIT_BASELINE_DIR` passes the same four assertions. The new package command runs both React modes and is registered in the main browser command.

Firefox independently observed original reconnect leaving Retry disabled and original disconnect leaving the frame interactive without an offline alert. It verified repaired early reconnect, one explicit reload, repaired early disconnect with inert game/overlay content and focused offline alert, and save Retry enabling then invoking one target wake. No browser errors or unhandled promises occurred.

## Broader verification

| Check | Assertions |
| --- | ---: |
| Connectivity commit and recovery actions | 804 |
| Offline keyboard/focus boundary | 3,438 |
| Startup bridge code recovery | 164 |
| Facebook/Reddit provider save recovery | 688 |
| Save notice and recovery | 850 |
| Total, zero failures | 5,944 |

All related checks ran in both React modes. General gates passed 2,756 unit tests across 297 suites, portal types, and TSDoc (25,180 declarations across 1,139 files). All six isolated builds and artifact audits passed: Jest, Facebook, Reddit, YouTube fixture, Netflix, Yahoo. The YouTube fixture does not establish release readiness. No game copy, provider APIs, economy, scoring, or persistence policy changed.

The built-game browser batch initially passed 37 of 38 tests; its remaining journey dispatched an `offline` event while `navigator.onLine` stayed true. That fixture was corrected to use `context.setOffline(true/false)`, exercising real browser network and status transitions. The affected full journey then passed, including offline keyboard confinement, gameplay, recovery, rewards, and navigation. The other 37 passing cases were unaffected. The unit/type/documentation gates were rerun after the two-line fixture correction. Synthetic lifecycle events in the YouTube suite intentionally verify that browser signals do not replace the target lifecycle API, and were preserved.

All 766 source inputs stayed frozen during initial runtime verification. The only subsequent input change was the owned browser fixture correction; all 766 remained unchanged during final gate rechecking. Source/package/verifier/test snapshots matched their final live files. `owned.diff` uses the package capture immediately before this pass's command registration, preserving independent shared-worktree edits.

All owned terminal sessions completed. Both owned Firefox tabs closed, the original blank tab remained, all three owned fixture servers stopped, and their scratch directories were removed. No owned verifier processes remained.

Evidence is under `artifacts/online-status-commit-2026-10-04/`: captured source, minimized failures and controls, original/final observations, screenshots, Firefox proof, inventories, `owned.diff`, `verification-summary.json`, and gate/build logs. The first action probe's toolbar intercepted the save Retry button; the fixture toolbar was moved clear and the complete action probe passed before final verification. This pass did not commit, push, or deploy. The broader improvement goal remains active. These checks establish connectivity and recovery correctness; they do not measure live-server availability, network latency, or frame rate.
