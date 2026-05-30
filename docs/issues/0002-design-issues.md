Title: Design issues — gameplay/provider-auth/billing follow-ups

Source: [docs/design-issues.html](docs/design-issues.html)

Workstream status: in progress and owned by the current docs backlog pass on 2026-05-30. Keep this file and the generated task index synchronized with the latest evidence notes.

- Current ownership note: this issue doc is actively worked by the current Codex thread. It remains open for coordination; sync before parallel edits so tracker notes stay consistent.
- 2026-05-30 refresh: the design follow-ups remain open. No new emulator evidence was captured in this pass; the next live work is still the loss-modal replay, rewarded-ad validation, Android gating checks, and Coin Purchase UX confirmation.
- Work-in-progress marker: this file remains in the active docs pass and should be coordinated before parallel edits until the tracker refresh lands.
- 2026-05-30 continuation: the current thread is still actively working this file, so the in-progress ownership marker should remain visible to other agents.
- 2026-05-30 tracker refresh: the loss-modal stranded-board / Next-action defect is already documented as fixed in DSI-021, the Coin Purchase UX surface is already covered by the responsive and matrix trackers, and the Android gating/back-flow proof is already evidenced by DSI-020/021/024. The remaining open work in this issue is the rewarded-ad provider-auth replay.

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
