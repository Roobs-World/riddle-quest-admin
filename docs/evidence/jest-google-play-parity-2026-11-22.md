# Jest and Google Play parity verification, 22 November 2026

## Delivered build

- Source: `19bb79127d07b13bcb32dc10f30bfb22b4337f5f` on `jest`.
- Jest version: `1.0.0-dev.20261122185421.19bb79127d07.bf585ba5`.
- Version ID: `01a2049c-32d9-7134-8d07-0716daf2e9d6`.
- [Exact preview](https://jest.com/g/riddle-q?versionId=01a2049c-32d9-7134-8d07-0716daf2e9d6).
- Jest management API confirms `ready`, `isActive: false`, and no processing error.
- Archive SHA-256: `cf5db1ae0a94091237f30f2f3e62f4f512d8a28401407726ea06df713617e02d`.
- The active October build was not changed. No publication or review submission was requested or performed.

## Parity changes

The source audit compared the implemented Android online game with Jest, including Classic and Daily play, confirmed economy, races, profiles, achievements, leaderboards, purchases, Premium, referrals, notifications and save recovery.

Jest now exposes its existing Reduced motion and High contrast preferences in Settings. These controls reuse shared translations and existing browser and platform persistence.

Jest now retries incomplete purchases after foregrounding, restored connectivity and registration. It uses the shared purchase-recovery controller, serializes overlapping signals, refreshes signed subscriptions and the authoritative balance, and retains account ownership and deletion guards. A committed replacement account also starts recovery when registration's earlier close event preceded the React update.

The owner clarified that Jest must support English only. Device language, browser preferences, restored platform preferences, later locale requests, startup content, race policy and price formatting now follow that requirement. Settings has no language selector. Other targets retain their language support. The original server restrictions on non-English Jest races and receipt lookup were restored and deployed.

Jest also enables the existing owned-race safety controls and human rematch controller. The backend rematch gate now accepts Jest and Android alongside Facebook and Reddit, while preserving owned terminal human seats, provider isolation, deletion, blocks, retention, quotas and idempotency. Both Android profiles must still carry canonical provisioning markers. History and direct username invitations remain outside the Jest capability set.

Platform-specific features retain their approved adapters. Android owns Google linking, Play Billing, FCM, Integrity, installation handoff and its separate offline surface. Jest uses its platform identity, payments, messaging and referral equivalents. Game-local profile editing remains hidden on Jest in accordance with its existing platform review requirements. Android provider release gates in `docs/android-parity-plan.md` remain open; this work does not certify a production Google Play release.

## Verification

- English-only and recovery client checks: 10 suites, 84 tests passed. These cover English locale enforcement, startup preparation, race policy, commerce, recovery, preferences and Settings.
- English-only race checks: 2 suites, 71 tests passed against isolated Firebase emulators, including Jest access and receipt authorization.
- Latest rematch/safety client checks: 2 suites, 12 tests passed through the real target adapter and shared transport boundary.
- Latest rematch backend checks: 25 real Firestore integration cases passed. New Jest and Android cases failed against the former gate before the fix. Coverage includes all four providers, explicit recipient acceptance, concurrent retries, blocked/deleted/expired/bot refusals, quotas and revoked Android provisioning markers.
- Jest production build, target boundaries, all-locale key consistency, license checks, console manifest, artifact audit, TSDoc audit and W3C HTML validation passed.
- The immutable upload was built from clean committed source. The full production suite and packaged browser suites were skipped for this release; the focused checks and live Firefox verification below were run instead.
- The artifact audit found 423 files, 4.75 MB total and 0.55 MB initial resources, with no native modules, other-target auth or ads, Google Analytics, secrets, source maps or missing entry assets.
- The eight affected race exports were successfully deployed in both `us-central1` and `europe-west1`: `getRaceAccess`, `findRaceMatch`, `listRaceCategories`, `startRaceRun`, `readyRaceRun`, `joinLiveRace`, `listLiveRaceHistory`, and `confirmLiveGuessReceipt`. No rules or indexes changed.
- The final rematch change required only `joinLiveRace`, which was successfully deployed again in both configured regions.

## Firefox sandbox observations

Both initial owner-supplied login links successfully authenticated separate sandbox accounts. The initial solo/commerce checks used English-only version `1.0.0-dev.20261122180716.9073f055ff48.220562ad`. The subsequent two-account checks below verified that version and the final replacement identified above. The game iframe paths were checked against the selected exact version.

The first account completed Daily play and received confirmed rewards, opened Profile and Achievements, changed both accessibility preferences, and retained them after reload. The English replacement loaded Classic with saved progress, `lang=en`, `dir=ltr`, and no language selector.

With explicit owner approval for sandbox transactions, a coin-pack checkout completed with zero credits charged and credited the game account. Premium checkout showed a zero recurring price, completed as a sandbox transaction, and added 3,400 coins without reloading the game. Profile showed Premium active. Cancellation succeeded and displayed that renewal was cancelled while access continued for the current billing period. Synthetic sandbox shipping details were used; no payment card was entered.

The second account began with its own 300-coin balance. It completed Daily play, received 460 confirmed coins, and used the enabled Next button to enter Classic. Captured guess and completion acknowledgements both succeeded. The first account's earlier delayed Next acknowledgement did not recur.

The second account also opened and retired a private friend lobby, started an English public race with the supported bot fallback, submitted a wrong answer and a correct answer, and advanced to the next riddle. After reload and re-entering multiplayer, the same opponent, progress and partial `SHO` draft were recovered. Completing that answer advanced progress again. The opponent finished first and the game displayed the confirmed result. Closing the result and category menu returned to the English game and Settings.

## Two-account follow-up with fresh login links

Fresh owner-supplied links authenticated in two independent Firefox containers before either link was consumed elsewhere. The accounts remained separate throughout the run. Their starting balances were 3,700 and 300 coins.

On the first English-only preview, both accounts selected History and entered public matchmaking together. Their screens showed reciprocal known player names, the same English questions and synchronized progress. The initial match briefly displayed the retry state, then recovered automatically without another join or a manual retry. No permanent failure was reproduced. Source inspection identifies a two-second poll deadline and automatic backoff; the specific cause of that transient delay was not established.

One account revealed a private letter and received its own 15-second penalty; the other account retained no revealed letter or penalty. Both submitted answers through the complete set of ten questions. The faster account finished 10/10; the other showed 9/10 when the match ended. Both displayed complementary results, and the winner displayed one confirmed +50-coin race grant. Achievement grants brought the balances to 3,725 and 425, which persisted unchanged after reload.

On final version `1.0.0-dev.20261122185421.19bb79127d07.bf585ba5`, the same two accounts matched again, with safety options available. A confirmed quit produced the expected terminal result and an enabled Rematch button. Neither account had answered in that short match, and no race reward was granted.

Rematch reserved a private lobby against the actual previous opponent. The recipient received an in-game invitation, explicitly selected Accept challenge, and both accounts entered the new match with the same English question. Merely creating and accepting the invitation did not change balances. The safety disclosure opened and showed Block opponent, the report reason and Report opponent. No block or abuse report was submitted.

The recipient answered the first rematch question correctly, and the other screen showed that progress. After the other account quit, the recipient displayed a confirmed +50-coin result. Its balance changed from 425 to 475 and remained 475 after reload. The other account remained at 3,725. The final iframe path contained the exact final build version.

Rematch invitations for Jest and Android use the durable in-game inbox. The existing rematch helper enqueues external push only for Facebook. External rematch push, live referral conversion and destructive account deletion were not exercised.

Temporary Firefox verification extensions and both isolated test contexts were removed after verification. Both branches were synchronized and pushed to origin. The final Jest build remains inactive.
