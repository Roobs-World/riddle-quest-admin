Title: Ad implementation — rewarded ads evidence and production IDs

Source: [docs/google-admob-rewarded-ads-implementation.md](docs/google-admob-rewarded-ads-implementation.md)

Workstream status: in progress and owned by the current docs backlog pass on 2026-05-30. This is still blocked on ad IDs and live replay evidence.

- Current ownership note: this issue doc remains actively worked by the current Codex thread while the ad evidence pass is open. It remains open for coordination.
- 2026-05-30 refresh: the ad work remains blocked on production-like IDs and live replay evidence. No new rewarded-ad callback or no-fill evidence was collected in this pass.
- Work-in-progress marker: this file remains in the active docs pass until the tracker refresh lands.
- 2026-05-30 continuation: the current thread still owns this ad evidence task; coordinate before parallel edits while the blocked workstream is active.
- 2026-05-30 tracker refresh: source-level rewarded-ad callback, fallback, and listener-cleanup coverage is already reflected in the companion docs. The remaining open work here is live replay evidence, production-like ad IDs, and any consent/privacy setup needed for emulator proof.

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
