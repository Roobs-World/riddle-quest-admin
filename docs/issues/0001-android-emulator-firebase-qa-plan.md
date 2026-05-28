Title: Android emulator QA — capture remaining provider-auth & billing evidence

Description:

- Source: [docs/android-emulator-firebase-qa-plan.html](docs/android-emulator-firebase-qa-plan.html)
- Goal: Collect the remaining QA evidence and close TODOs listed in the Android emulator QA plan.

Checklist:

- [ ] Capture provider-auth UID/snapshot evidence for a disposable provider-auth account (before/after snapshots)
- [ ] Replay provider-auth flows that previously failed and capture Firebase backend deltas (logs + screenshots)
- [ ] Verify Coin Shop pay/play actions end-to-end (production-like billing or staging billing) and capture logs
- [ ] Obtain production-like ad IDs and verify rewarded-ad callback/no-fill behavior; capture logs/screenshots
- [ ] Test all registered modals (welcome, victory, loss, coinShop, etc.) and attach screenshots for each emulator size
- [ ] Evidence account deletion, data export, and localized About/Legal reachability for provider-auth accounts

Prerequisites / Blockers:

- Disposable provider-auth account or test credentials with Firebase access
- Production-like billing/ad IDs or a staging environment that mirrors production

Assignee: TBD
