Title: Design issues — gameplay/provider-auth/billing follow-ups

Source: [docs/design-issues.html](docs/design-issues.html)

Workstream status: in progress and owned by the current docs backlog pass on 2026-05-30. Keep this file and the generated task index synchronized with the latest evidence notes.

- Current ownership note: this issue doc is actively worked by the current Codex thread. It remains open for coordination; sync before parallel edits so tracker notes stay consistent.
- 2026-05-30 refresh: the design follow-ups remain open. No new emulator evidence was captured in this pass; the next live work is still the loss-modal replay, rewarded-ad validation, Android gating checks, and Coin Purchase UX confirmation.
- Work-in-progress marker: this file remains in the active docs pass and should be coordinated before parallel edits until the tracker refresh lands.
- 2026-05-30 continuation: the current thread is still actively working this file, so the in-progress ownership marker should remain visible to other agents.
- 2026-05-30 tracker refresh: the loss-modal stranded-board / Next-action defect is already documented as fixed in DSI-021, the Coin Purchase UX surface is already covered by the responsive and matrix trackers, and the Android gating/back-flow proof is already evidenced by DSI-020/021/024. The remaining open work in this issue is the rewarded-ad provider-auth replay.
- 2026-05-31 source verification: focused Jest now passes for `RewardedAdService` and the rewarded-ad branches inside `GameScreen`, including the authenticated coin-shop callback path and the guest local-only fallback. That confirms the replay logic in source, but the live provider-auth and guest emulator replay still needs on-device evidence before the checklist item can be closed.
- 2026-05-31 live follow-up: the active emulator pass returned to the main game and verified the settings/help navigation again, but no rewarded-ad replay evidence was captured in this session. The rewarded-ad replay item remains open until the provider-auth and guest flows are exercised end-to-end on device.
- 2026-05-31 live follow-up: the About / Legal modal was opened from Settings and the Privacy Policy row reached Chrome, which confirms the legal reachability branch. The rewarded-ad replay path was still not captured end-to-end on device, so the replay checklist item stays open.
- 2026-05-31 live follow-up: the modal-testing panel exposed the loss modal, but the rewarded-ad continue button did not produce a visible ad replay or completion callback in this pass. Treat the replay item as still in progress, not blocked, until the next live pass proves the ad lifecycle or records a not-ready fallback.
- 2026-05-31 live follow-up: the Credits link in the About / Legal modal also opens Chrome and lands on `harrisonsounds.com`, which further confirms the legal-link handling. The rewarded-ad replay item still needs a visible guest/provider-auth completion or fallback capture before it can be closed.
- 2026-05-31 live follow-up: the provider-auth modal open is now confirmed in logcat too, but the visible profile sheet still stays hidden, so that only improves the surrounding QA context; it does not close the rewarded-ad replay item. The ad path remains open until we get a visible load/play/callback or not-ready capture.
- 2026-05-31 source verification follow-up: `pnpm exec tsc --noEmit --pretty false` stayed clean and the focused modal tests remain green, so the remaining work is still live rewarded-ad evidence rather than a source regression.
- 2026-05-31 source verification follow-up: `ModalTogglePanel` quick-action coverage also passed, which verifies the debug control surface while the live rewarded-ad replay item remains open.
- 2026-05-31 live follow-up: the rewarded-ad flow now reaches a live Google test ad and a visible `Reward granted` state for the provider-auth path. That proves the replay itself on-device, but the guest parity plus backend callback/newCoins evidence are still open.
- 2026-05-31 live follow-up: the dev-only QA timers now appear in live logcat as `[WelcomeBackModal QA] Dev auto-dismiss firing` followed by `[ModalTogglePanel QA] Opening profile modal`. That confirms the helper chain is executing in the emulator, but the visible profile sheet is still not captured on-screen, so the provider-auth snapshot and backend reward evidence stay open.

Checklist:

- [x] Reproduce loss-modal stranded-board/Next-action bug; add reproducible steps and screenshot (covered by DSI-021 in the companion design tracker)
- [ ] Verify rewarded-ad replay completes and grants coins in provider-auth and guest flows
- [x] Validate loss/skip/continue action gating and Back behavior on Android (covered by DSI-020/021/024 in the companion design tracker)
- [x] Confirm Coin Purchase UX (title, coin art, chest balance, confirm action) across emulator sizes (covered by the Coin Shop and matrix evidence in the companion trackers)

Blockers:

- Requires emulator runs and test billing/ad IDs

Assignee: Gameplay QA / Android

Milestones:

- Reproduce and document the loss-modal stranded-board / Next-action flow
- Verify rewarded-ad replay in guest and provider-auth paths
- Validate loss, skip, continue, and Back gating on Android
- Confirm Coin Purchase layout, balance, and confirmation UX across emulator sizes
