# Package update and Jest retest, 22 November 2026

## Delivered preview

- Code commit: `0383978798045633b1fc665f9b33c45af98e6676` on `jest`.
- Jest version: `1.0.0-dev.20261122211556.038397879804.6baabd3f`.
- Version ID: `01a2051e-04e2-77ad-b76d-e058e3060bb3`.
- [Exact preview](https://jest.com/g/riddle-q?versionId=01a2051e-04e2-77ad-b76d-e058e3060bb3).
- The official Jest management tool confirms `ready`, `isActive: false`, no processing error and 4,330,391 hosted bytes.
- The gated ZIP contains 2,627,120 bytes; SHA-256: `714680f051539460e1a2fcf2ac87f51aa65ccbac1b6ebe05e3a2d0f0d9405f1d`.
- The October active build remains active. No activation, publication or review submission was performed.

## Package scope and compatibility

The review covered ten manifests, 142 external dependency/peer declarations, the standalone worker and seven native SDK pins. Eligible stable updates were adopted across the web, shared packages, Functions, Android, Reddit and the worker. [Package modernization](../package-modernization.md) records the remaining Node 22, React Native, Babel, TypeScript, Google ID and release-age constraints, plus the three remaining moderate development-only advisories. The production audit has no findings.

Jest remains English-only. Its build now excludes unreachable non-English locale modules before graph construction. Other targets retain their catalogs. All 29 image, font, audio and SVG asset hashes remained identical during the reduction. The Firebase app transform removes only the unused Analytics script URL and Crashlytics version metadata; actual SDK tests preserve every remaining Auth/App Check URL and product mapping. Artifact security and size limits are unchanged.

The release supports pnpm 12's native executable, snapshots committed SQLite WAL records for license generation, and distinguishes pnpm's generated status files from immutable installed dependencies. Regression checks still detect changed package bytes, manifests, lockfiles, `.modules.yaml`, modes and symlinks.

The updated accessibility checker caught the coin-shop button omitting its visible balance from its accessible name. The label now includes that balance and reuses translated text. Browser expectations now enforce English instead of trying to select another Jest language. One registration test now waits for either the next guidance tooltip or the asynchronously rendered registration dialog within the same five-second limit.

## Automated verification

- Workspace: 4,199 tests passed across core, solo, hosted, Android, portal and Reddit. The ordinary portal run retains 129 expected browser-only/conditional skips; the supplemental browser runs below were executed separately.
- Core coverage: 476 tests, 100% statements, branches, functions and lines.
- Backend on Node 22.23.1 with actual isolated Firestore, Storage and Database emulators: 245 suites, 3,277 tests passed. Coverage: 90.27% statements, 85.94% branches, 89.63% functions, 92.19% lines. Existing thresholds remain unchanged.
- Backend types, ESLint, deployment environment and independent npm deployment-lock checks passed. Date-only integration fixtures now keep `Date.now()` and `new Date()` consistent while retaining real networking timers. Signed identity, nonce, replay, quota, deletion and race assertions remain intact; no production authorization workaround was added.
- Portal account browser suite: 46/46 passed, including restored Turkish/Arabic preferences remaining English, commerce, subscriptions, referral entry, registration and account lifecycle scenarios.
- Main hosted gameplay journey, short-phone layout and startup-audio browser suites passed. The hosted journey includes accessibility checks, guest progress, gameplay, rewards and navigation.
- Other provider browser adapters: five suites, 17 cases passed. Netflix, Yahoo and GameSnacks each passed packaged solve, reward and reload flows.
- Screenshot comparison: 20 Chromium and 19 WebKit game views passed, plus eight fixtures per browser. The updated WebKit binary used libraries unpacked under `/tmp`; no system packages were installed.
- All seven web target builds and the Reddit package contract passed. Release-script suite: 238 checks passed. Architecture, target boundaries, locales, notices, security, scalability, monetization, file-size and TSDoc checks passed. Pinned Nu 26.11.20 reported zero HTML findings.
- Android's synchronized final graph passed types and 192 tests. A forced Metro release bundle and x86_64 release APK compiled successfully. The actual bundle map contains React 19.3.1, Firebase 13.4.0 and Babel runtime 7.29.15 only for those families.
- Standalone worker: 10 tests passed and its independent audit has no findings. The downloaded Codex binary's layout and required flags were checked.

The immutable upload skipped the full `verify:production:extended` orchestration and its packaged browser repetition. The individual checks above and the live checks below were run. The first upload attempt stopped before transmission when pnpm 12 bookkeeping changed the dependency fingerprint; the corrected release passed that guard and uploaded the committed source.

## Firefox sandbox observations

The existing authenticated sandbox session remained valid. The iframe path matched the exact uploaded version throughout. The game reported `lang=en`, `dir=ltr`, and Settings had no language selector. Reduced motion and High contrast persisted after toggling and reload; both were restored to their original On values.

Daily play accepted `WHEAT`, confirmed a 160-coin breakdown and advanced the balance from 475 to 635. Next entered Classic. `COMPASS` then confirmed a 45-coin breakdown, advanced the balance to 680 and enabled Next Level. Profile, achievements and the next Classic riddle loaded in English.

Under the owner's existing sandbox-only transaction approval, the 250-coin pack checkout explicitly stated that it would not charge. It completed and the balance became 955, including the configured 25-coin first-purchase achievement bonus. Premium checkout displayed £0.00 per month, required no payment card, and used synthetic sandbox shipping details. It completed and granted 3,400 coins, bringing the balance to 4,355. Profile showed Premium active. The platform cancellation confirmation completed, and the game reported that renewal was cancelled while access continued for the billing period. The balance remained 4,355 through subsequent reloads.

A public race used the supported guest bot fallback. A wrong `PLANET` guess produced visible letter feedback; correct `BEAGLE` advanced progress. Reload and re-entry recovered that opponent's terminal 10/10 result with the player's confirmed 1/10 progress and no loss reward.

A second public race retained the same opponent, running clock and partial `FUT` draft after reload and re-entry. Appending `URE` completed the answer and advanced progress. A hint revealed a private `C` and added the expected 15-second penalty; completing `CANDLE` advanced progress again. Quitting received confirmation and returned to category selection. A friend lobby reached its owned 1/2 waiting state and was then retired successfully without sharing an invitation. The balance remained 4,355.

No game error or unhandled-rejection event was captured in these observed sessions. Both temporary verification extensions were removed and the clean exact preview was left open. The latest live run used one account and bot fallback; a simultaneous two-account human/rematch retest needs fresh single-use login links. The earlier two-account verification is recorded in [the parity evidence](jest-google-play-parity-2026-11-22.md).

## Production backend status

The dependency deployment is prepared and validated for all 140 existing production Functions, retaining Node 22, both configured regions and zero reserved warm instances. It would change Functions only.

Automatic approval review rejected that deployment because the request did not explicitly authorize a shared production backend rollout. No deployment started, and no alternate route was attempted. Explicit owner approval was requested. The uploaded Jest preview and live Firefox checks therefore used the existing production backend.
