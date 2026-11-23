# Discovery retry policy ownership

Retry previously relied on public readiness, search status and failure recovery fields. Presentation edits could bypass a provider wait, retry terminal access denial, reuse a consumed receipt when new intent was required, rotate a retryable network receipt unnecessarily, or suppress an otherwise available retry.

The current discovery intent privately retains a clone of accepted recovery facts. The shared `canRetryRaceMatch` rule drives both dispatch and derived readiness from that policy and the monotonic deadline. Empty searches retain new-intent recovery privately. A live private discovery wait also prevents reentrant Retry dispatch even when public loading fields change. Existing provider retirement and recovery journal ownership remain intact.

Six regressions failed before the fix; the valid control passed. All seven focused cases and fourteen rendered desktop/mobile browser cases pass. Real Retry clicks retain or rotate receipts according to private policy; direct attempts cannot bypass a deadline or terminal failure. The full client suite passes 1,787 tests across 214 suites, with 103 tests across 14 suites skipped in the current shared worktree. Retained retirement, visibility and discovery-cancellation browser gates pass.

The change initially exceeded the session's source-size limit by one equivalent line. Discovery intent and its shared readiness rule were extracted to `logic/raceDiscoveryRecovery.ts`. The module's documented interface keeps presentation policy derivation aligned with dispatch. Client types, documentation, file size, security and scalability audits pass; isolated builds and dependency audits are required for the checkpoint.

The guarded manifest `docs/common/development/development-tasks/race-discovery-retry-policy.json` retains 84 preceding checks and adds the retry-policy browser gate. Dashboard completion requires all 85 checks plus unchanged full source digest and HEAD. The ongoing multiplayer audit is not marked complete by this checkpoint. Hosted E2E and mobile confirmation remain separate evidence.

Jest remains an unpublished draft. This checkpoint does not deploy Functions or publish a game.
