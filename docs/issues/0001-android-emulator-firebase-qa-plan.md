Title: Android emulator QA — capture remaining provider-auth & billing evidence

Description:

- Source: [docs/android-emulator-firebase-qa-plan.html](docs/android-emulator-firebase-qa-plan.html)
- Goal: Collect the remaining QA evidence and close TODOs listed in the Android emulator QA plan.
- Workstream status: in progress and owned by the current docs backlog pass on 2026-05-30. Do not parallel-edit this file until the tracker refresh lands.
- Current ownership note: this issue doc is owned by the current Codex thread while the docs backlog pass is active.
- 2026-05-30 refresh: no new emulator evidence was added in this pass. The current ownership signal is in `docs/tasks.html` and the memory-bank files; continue provider-auth snapshot, backend delta, billing, ad replay, and account-closure evidence when the required credentials or devices are available.
- 2026-05-30 continuation: this file remains actively worked by the current thread, so keep the lock in place until the next evidence refresh is published.
- 2026-05-30 tracker refresh: several sub-slices are already evidenced in companion trackers, including guest logout/restart, support handoff, credits handoff, legal URL reachability, and modal coverage. This plan still keeps the provider-auth snapshots/deltas, billing/ad proof, and account-deletion/provider-legal closure open until they are individually verified.
- 2026-05-30 tracker refresh: the modal coverage slice is now already evidenced in the companion responsive/matrix trackers, so the remaining open work here is the provider-auth, billing/ad, and account-closure evidence.

Checklist:

- [ ] Capture provider-auth UID/snapshot evidence for a disposable provider-auth account (before/after snapshots)
- [ ] Replay provider-auth flows that previously failed and capture Firebase backend deltas (logs + screenshots)
- [ ] Verify Coin Shop pay/play actions end-to-end (production-like billing or staging billing) and capture logs
- [ ] Obtain production-like ad IDs and verify rewarded-ad callback/no-fill behavior; capture logs/screenshots
- [x] Test all registered modals (welcome, victory, loss, coinShop, etc.) and attach screenshots for each emulator size (covered by the ModalProvider and responsive matrix coverage in the companion trackers)
- [ ] Evidence account deletion, data export, and localized About/Legal reachability for provider-auth accounts

Prerequisites / Blockers:

- Disposable provider-auth account or test credentials with Firebase access
- Production-like billing/ad IDs or a staging environment that mirrors production

Assignee: Android QA / Firebase

Milestones:

- Provider-auth identity and snapshot evidence
- Backend delta replay and log capture
- Coin Shop billing replay with staging or production-like IDs
- Rewarded-ad lifecycle replay with callback logging
- Modal screenshots across the configured emulator matrix
- Account deletion, data export, and localized legal reachability
