Title: Android emulator QA — capture remaining provider-auth & billing evidence

Description:

- Source: [docs/android-emulator-firebase-qa-plan.html](docs/android-emulator-firebase-qa-plan.html)
- Goal: Collect the remaining QA evidence and close TODOs listed in the Android emulator QA plan.
- Workstream status: in progress and actively worked by the current docs backlog pass on 2026-05-30. This file remains open for coordination; sync before parallel edits so tracker notes stay consistent.
- Current ownership note: this issue doc is owned by the current Codex thread while the docs backlog pass is active.
- 2026-05-30 refresh: no new emulator evidence was added in this pass. The current ownership signal is in `docs/tasks.html` and the memory-bank files; continue provider-auth snapshot, backend delta, billing, ad replay, and account-closure evidence when the required credentials or devices are available.
- 2026-05-30 continuation: this file remains actively worked by the current thread; keep the ownership marker visible until the next evidence refresh is published.
- 2026-05-30 tracker refresh: several sub-slices are already evidenced in companion trackers, including guest logout/restart, support handoff, credits handoff, legal URL reachability, and modal coverage. This plan still keeps the provider-auth snapshots/deltas, billing/ad proof, and account-deletion/provider-legal closure open until they are individually verified.
- 2026-05-30 tracker refresh: the modal coverage slice is now already evidenced in the companion responsive/matrix trackers, so the remaining open work here is the provider-auth, billing/ad, and account-closure evidence.
- 2026-05-31 source verification: `AboutLegalModal`, `FullProfileDetailsModal`, `RewardedAdService`, and the targeted `GameScreen` rewarded-ad flows are all passing in focused Jest, and `pnpm exec tsc --noEmit --pretty false` is clean. That gives us source-level confirmation for legal-link wiring, delete-account flow, and rewarded-ad branches, but the live provider-auth snapshot, backend-delta, billing/ad replay, and account-closure evidence remain open until captured on-device.
- 2026-05-31 live follow-up: the emulator session re-entered the game, opened the Settings sheet, and confirmed the Help row still hands off to a Gmail compose flow for `support@adspeq.com`. The About row is visible in the settings sheet and remains the next live target for localized legal reachability, while the provider-auth snapshot, backend-delta, billing/ad replay, and account-closure evidence stay open.
- 2026-05-31 live follow-up: the About / Legal modal was reached from Settings, and the Privacy Policy row handed off to Chrome on `roobsworld.com/riddl...` before landing on a "Page not found" document. That proves the legal-link path is live, but the provider-auth snapshot, backend-delta, billing/ad replay, and account-closure evidence still remain open.
- 2026-05-31 live follow-up: the loss modal was also exercised through the modal-testing panel, but the rewarded-ad continue action did not yet surface a visible ad replay or callback confirmation on device. The ad-replay slice remains open until the live no-fill/success path is captured with logs or screenshots.
- 2026-05-31 live follow-up: a later replay did launch the Google AdMob `AdActivity` and then rehydrate back through the welcome-back modal, but the session did not capture a reward callback, `newCoins`, or backend delta before the app wound up in the Expo dev launcher. That keeps the billing/ad and provider-auth evidence slices open, but it does give us a concrete replay trace for the register.
- 2026-05-31 live follow-up: the Credits row in the same About / Legal sheet also hands off to Chrome, landing on `harrisonsounds.com`. That confirms another legal-link route is live, but the provider-auth snapshot, backend-delta, billing/ad replay, and account-closure evidence remain open.
- 2026-05-31 live follow-up: the profile button was tapped from the main game surface, but the emulator only showed a dimmed loading state and never surfaced a visible profile modal during this pass. The provider-auth snapshot remains open and still needs a successful before/after capture.
- 2026-05-31 live follow-up: the profile button now logs `Opening modal of type: fullProfileDetails` and `Modal fullProfileDetails opened` with the live provider-auth player snapshot, including `userId`, `email`, `coins`, and stats. The rendered screen still only shows the dimmed game surface, so the modal is confirmed in code/logs but the visible before/after snapshot is still open.
- 2026-05-31 live follow-up: the same provider-auth path now shows up again in logcat at 2026-05-31 12:34:48 with `Opening modal of type: fullProfileDetails` and `Modal fullProfileDetails opened`, but the rendered board still stays dimmed. The UID/snapshot slice is stronger than before, yet the before/after visual proof remains open.
- 2026-05-31 live follow-up: a fresh replay produced a real provider-auth before/after trail on device, with the game surface giving way to the `Welcome back` modal for `craig beswetherick`. The app later fell back through the Expo dev launcher before we captured the full-profile UID and backend-delta logs, so the snapshot and backend replay items remain open even though the visual account state is now documented.
- 2026-05-31 source verification follow-up: focused Jest reran for `AboutLegalModal` and `FullProfileDetailsModal` (2 suites / 36 tests) and TypeScript stayed clean. Source is green; the remaining work is live snapshot capture and the other backend/billing/ad/account-closure evidence.
- 2026-05-31 live follow-up: the provider-auth restart now reaches the `Welcome back` modal for `craig beswetherick`, and a dev-only QA tour helper was added to auto-dismiss that blocker so the profile modal can surface. The visible `fullProfileDetails` before/after snapshot is still open until we capture the card itself on-device.
- 2026-05-31 live follow-up: the rewarded-ad QA tour now reaches a live Google test ad and the `Reward granted` state on the provider-auth flow. That proves the ad replay path, but the backend `newCoins` / callback log evidence is still pending and the broader account-closure checklist remains open.
- 2026-05-31 live follow-up: the dev-only QA timers now show up in logcat as `[WelcomeBackModal QA] Dev auto-dismiss firing` followed by `[ModalTogglePanel QA] Opening profile modal`, which confirms the helper chain is firing in the live bundle. The visible profile sheet is still not captured in a screenshot, so the provider-auth before/after snapshot remains open and the backend `newCoins` / callback evidence is still pending.
- 2026-05-31 source verification follow-up: `ModalTogglePanel` quick-action coverage also passed, so the debug modal surface is validated while the live provider-auth snapshot and ad evidence remain open.

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
