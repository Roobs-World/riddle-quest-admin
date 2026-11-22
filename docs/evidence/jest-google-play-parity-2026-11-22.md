# Jest and Google Play parity verification, 22 November 2026

## Delivered build

- Source: `9073f055ff48a5fcc75980ec5ff021121059d411` on `jest`.
- Jest version: `1.0.0-dev.20261122180716.9073f055ff48.220562ad`.
- Version ID: `01a20471-18bb-7478-94db-f12ec867ca3e`.
- [Exact preview](https://jest.com/g/riddle-q?versionId=01a20471-18bb-7478-94db-f12ec867ca3e).
- Jest management API confirms `ready`, `isActive: false`, and no processing error.
- Archive SHA-256: `c0ec8d6e9e771311bd348e6e8815eb8ff77c47f3225c3fee6ecc875892f09607`.
- The active October build was not changed. No publication or review submission was requested or performed.

## Parity changes

The source audit compared the implemented Android online game with Jest, including Classic and Daily play, confirmed economy, races, profiles, achievements, leaderboards, purchases, Premium, referrals, notifications and save recovery.

Jest now exposes its existing Reduced motion and High contrast preferences in Settings. These controls reuse shared translations and existing browser and platform persistence.

Jest now retries incomplete purchases after foregrounding, restored connectivity and registration. It uses the shared purchase-recovery controller, serializes overlapping signals, refreshes signed subscriptions and the authoritative balance, and retains account ownership and deletion guards. A committed replacement account also starts recovery when registration's earlier close event preceded the React update.

The owner clarified that Jest must support English only. Device language, browser preferences, restored platform preferences, later locale requests, startup content, race policy and price formatting now follow that requirement. Settings has no language selector. Other targets retain their language support. The original server restrictions on non-English Jest races and receipt lookup were restored and deployed.

Platform-specific features retain their approved adapters. Android owns Google linking, Play Billing, FCM, Integrity, installation handoff and its separate offline surface. Jest uses its platform identity, payments, messaging and referral equivalents. Game-local profile editing remains hidden on Jest in accordance with its existing platform review requirements. Android provider release gates in `docs/android-parity-plan.md` remain open; this work does not certify a production Google Play release.

## Verification

- Final focused client checks: 10 suites, 84 tests passed. These cover English locale enforcement, startup preparation, race policy, commerce, recovery, preferences and Settings.
- Final race checks: 2 suites, 71 tests passed against isolated Firebase emulators, including English-only Jest access and receipt authorization.
- Jest production build, target boundaries, all-locale key consistency, license checks, console manifest, artifact audit, TSDoc audit and W3C HTML validation passed.
- The immutable upload was built from clean committed source. The full production suite and packaged browser suites were skipped for this release; the focused checks and live Firefox verification below were run instead.
- The artifact audit found 423 files, 4.75 MB total and 0.55 MB initial resources, with no native modules, other-target auth or ads, Google Analytics, secrets, source maps or missing entry assets.
- The eight affected race exports were successfully deployed in both `us-central1` and `europe-west1`: `getRaceAccess`, `findRaceMatch`, `listRaceCategories`, `startRaceRun`, `readyRaceRun`, `joinLiveRace`, `listLiveRaceHistory`, and `confirmLiveGuessReceipt`. No rules or indexes changed.

## Firefox sandbox observations

Both owner-supplied login links successfully authenticated separate sandbox accounts. The game iframe was checked against the exact uploaded version above.

The first account completed Daily play and received confirmed rewards, opened Profile and Achievements, changed both accessibility preferences, and retained them after reload. The English replacement loaded Classic with saved progress, `lang=en`, `dir=ltr`, and no language selector.

With explicit owner approval for sandbox transactions, a coin-pack checkout completed with zero credits charged and credited the game account. Premium checkout showed a zero recurring price, completed as a sandbox transaction, and added 3,400 coins without reloading the game. Profile showed Premium active. Cancellation succeeded and displayed that renewal was cancelled while access continued for the current billing period. Synthetic sandbox shipping details were used; no payment card was entered.

The second account began with its own 300-coin balance. It completed Daily play, received 460 confirmed coins, and used the enabled Next button to enter Classic. Captured guess and completion acknowledgements both succeeded. The first account's earlier delayed Next acknowledgement did not recur.

The second account also opened and retired a private friend lobby, started an English public race with the supported bot fallback, submitted a wrong answer and a correct answer, and advanced to the next riddle. After reload and re-entering multiplayer, the same opponent, progress and partial `SHO` draft were recovered. Completing that answer advanced progress again. The opponent finished first and the game displayed the confirmed result. Closing the result and category menu returned to the English game and Settings.

A simultaneous match between the two supplied accounts was not completed. Reusing the first login link did not authenticate a fresh isolated browser context after its earlier successful use. A fresh first-account link was requested. Live referral conversion, destructive account deletion and external notification delivery were not exercised in this session.

Temporary Firefox verification extensions and the unused isolated test context were removed after verification. Both branches were synchronized and pushed to origin.
