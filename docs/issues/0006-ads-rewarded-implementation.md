Title: Ad implementation — rewarded ads evidence and production IDs

Source: [docs/google-admob-rewarded-ads-implementation.md](docs/google-admob-rewarded-ads-implementation.md)

Workstream status: in progress and owned by the current docs backlog pass on 2026-05-30. This is still blocked on ad IDs and live replay evidence.

- Current ownership note: this issue doc remains actively worked by the current Codex thread while the ad evidence pass is open. It remains open for coordination.
- 2026-05-30 refresh: the ad work remains blocked on production-like IDs and live replay evidence. No new rewarded-ad callback or no-fill evidence was collected in this pass.
- Work-in-progress marker: this file remains in the active docs pass until the tracker refresh lands.
- 2026-05-30 continuation: the current thread still owns this ad evidence task; coordinate before parallel edits while the blocked workstream is active.
- 2026-05-30 tracker refresh: source-level rewarded-ad callback, fallback, and listener-cleanup coverage is already reflected in the companion docs. The remaining open work here is live replay evidence, production-like ad IDs, and any consent/privacy setup needed for emulator proof.
- 2026-05-31 source verification: `RewardedAdService` and the targeted `GameScreen` rewarded-ad flows now pass in focused Jest, including the no-fill branch, temporary listener cleanup, authenticated callback processing, and guest local-only fallback. The source implementation is validated, but the production-like IDs and live replay evidence are still outstanding.
- 2026-05-31 live follow-up: the current emulator session was redirected into settings/help and Gmail handoff evidence instead of the rewarded-ad path, so no new ad replay logs or callback screenshots were collected this pass. Production-like IDs and live replay evidence remain open.
- 2026-05-31 live follow-up: the emulator also exercised the About / Legal branch and reached Chrome on the privacy-policy path, which is useful for the legal-disclosure side of the rollout. The rewarded-ad continue path was still not observed as a visible replay, so the live ad evidence remains open.
- 2026-05-31 live follow-up: the loss modal was opened through the modal-testing panel and the watch-ad continue action was attempted, but no visible replay, no-fill dialog, or callback screenshot was captured yet. Keep the ad evidence slice open until we can prove the load/play/callback lifecycle on device.
- 2026-05-31 live follow-up: the provider-auth QA tour now reaches a live Google test ad and a visible `Reward granted` state, so the replay path itself is proven on-device. The remaining open work is the backend `awardedAdCallback` / `newCoins` logs and the guest parity evidence.
- 2026-05-31 live follow-up: the dev-only QA path also auto-dismissed the welcome-back blocker so the rewarded-ad surface could be exercised from a clean provider-auth restart. That helper is only to unblock evidence capture; it does not change the production ad flow.
- 2026-05-31 live follow-up: the latest emulator replay also logs `[WelcomeBackModal QA] Dev auto-dismiss firing` and `[ModalTogglePanel QA] Opening profile modal`, which confirms the helper chain is running in the live bundle. The visible profile sheet still has not been captured, so the backend `awardedAdCallback` / `newCoins` logs and guest parity evidence remain open.

Checklist:

- [ ] Provide production-like ad IDs or staging equivalents for Android and iOS
- [ ] Verify rewarded-ad load/play/callback lifecycle and record logs for no-fill and success
- [ ] Capture emulator/provider-auth ad replay evidence and callback processing (newCoins, callbacks processed)

Blockers:

- Needs ad IDs and possibly consent/privacy test setups

Assignee: Monetization QA / AdOps

Milestones:

- Stage or provision production-like Google Mobile Ads IDs for Android and iOS
- Verify rewarded-ad load, playback, no-fill, and success callbacks
- Capture provider-auth and guest replay evidence with callback processing logs
