# Package update and Jest retest, 22 November 2026

## Current deployed versions checked before changes

- Latest processed preview source: `1cea57fe0d7191a6498f5991aa85b43dd44f8be4` on `jest`.
- Jest version: `1.0.0-dev.20261122230946.1cea57fe0d71.e6da0674`.
- Version ID: `01a20586-22d3-74dd-8931-336ffbf3ece8`.
- [Exact preview](https://jest.com/g/riddle-q?versionId=01a20586-22d3-74dd-8931-336ffbf3ece8).
- The official Jest management tool confirms `READY`, `isActive: false`, and no processing error.
- Production remains the October build `01a17226-db08-708f-86a1-6733b1fe4824`, version `1.0.0-dev.20261025-review-complete`. No activation, publication or review submission was performed.
- The Functions revision and traffic inventory was checked separately. Backend Sentry releases identify Cloud Run revisions, rather than the frontend source commit. The current scheduler is `dailychallengescheduler-00056-kax`.

The earlier processed preview was `01a2051e-04e2-77ad-b76d-e058e3060bb3`, version `1.0.0-dev.20261122211556.038397879804.6baabd3f`, from source `0383978798045633b1fc665f9b33c45af98e6676`. Its gated ZIP was 2,627,120 bytes with SHA-256 `714680f051539460e1a2fcf2ac87f51aa65ccbac1b6ebe05e3a2d0f0d9405f1d`. The single-account observations below belong to that earlier preview; the later two-account observations identify the current preview explicitly.

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
- Purchase-recovery reporting correction: 147 targeted tests passed across the recovery hook, purchase coordinator and Jest SDK adapter. The new regression first reproduced two reports for one failure, then verified one original report, an unsettled receipt after failed granting, and successful recovery on the next browser wake. Portal TypeScript and the TSDoc audit also passed.

The immutable upload skipped the full `verify:production:extended` orchestration and its packaged browser repetition. The individual checks above and the live checks below were run. The first upload attempt stopped before transmission when pnpm 12 bookkeeping changed the dependency fingerprint; the corrected release passed that guard and uploaded the committed source.

## Earlier preview Firefox sandbox observations

The existing authenticated sandbox session remained valid. The iframe path matched the exact uploaded version throughout. The game reported `lang=en`, `dir=ltr`, and Settings had no language selector. Reduced motion and High contrast persisted after toggling and reload; both were restored to their original On values.

Daily play accepted `WHEAT`, confirmed a 160-coin breakdown and advanced the balance from 475 to 635. Next entered Classic. `COMPASS` then confirmed a 45-coin breakdown, advanced the balance to 680 and enabled Next Level. Profile, achievements and the next Classic riddle loaded in English.

Under the owner's existing sandbox-only transaction approval, the 250-coin pack checkout explicitly stated that it would not charge. It completed and the balance became 955, including the configured 25-coin first-purchase achievement bonus. Premium checkout displayed £0.00 per month, required no payment card, and used synthetic sandbox shipping details. It completed and granted 3,400 coins, bringing the balance to 4,355. Profile showed Premium active. The platform cancellation confirmation completed, and the game reported that renewal was cancelled while access continued for the billing period. The balance remained 4,355 through subsequent reloads.

A public race used the supported guest bot fallback. A wrong `PLANET` guess produced visible letter feedback; correct `BEAGLE` advanced progress. Reload and re-entry recovered that opponent's terminal 10/10 result with the player's confirmed 1/10 progress and no loss reward.

A second public race retained the same opponent, running clock and partial `FUT` draft after reload and re-entry. Appending `URE` completed the answer and advanced progress. A hint revealed a private `C` and added the expected 15-second penalty; completing `CANDLE` advanced progress again. Quitting received confirmation and returned to category selection. A friend lobby reached its owned 1/2 waiting state and was then retired successfully without sharing an invitation. The balance remained 4,355.

No game error or unhandled-rejection event was captured by the temporary verification extensions in these observed sessions. Both extensions were removed. Subsequent Sentry inspection found handled errors, described below. The earlier two-account verification is recorded in [the parity evidence](jest-google-play-parity-2026-11-22.md).

## Fresh two-account Firefox retest

Two distinct fresh sandbox accounts were authenticated in separate browser containers. They matched each other as human opponents in a public race, rather than using the bot fallback. The first public match finished as a 7/10 tie.

On the exact `1cea57fe0d71` preview identified above, a later public match paired the same two human players. Account B confirmed quitting; account A received the complementary win and one 50-coin reward. A private rematch invitation was then delivered to B, who explicitly accepted it. Account A confirmed quitting that rematch; account B received the complementary win and one 50-coin reward. Both final authoritative balances were 3,800 coins.

A read-only `JestSDK.payments.getIncompletePurchases()` call succeeded for each of these current-preview accounts. Both summaries reported zero incomplete purchases, `hasMore: false`, and a present signed envelope. No receipt or signature contents were recorded. These reads did not grant or complete purchases.

## Production backend status

After explicit owner approval, 136 source-owned Function instances were deployed with the dependency updates. Four remote-only legacy instances were retained without deletion: `listLiveRaceHistoryPage` in both regions, and `blockLiveRaceOpponent` and `reportLiveRaceOpponent` in `us-central1`.

The final inventory confirms all 140 instances are `ACTIVE`, use Node 22, retain their configured `europe-west1` or `us-central1` region, and reserve zero warm instances. All 26 previously configured maximum-instance caps of 20 were restored. Each service's ready revision matches its created revision and receives 100% of traffic.

## Sentry findings and corrections

Sentry was inspected in organization `roobs-world-limited`, project `riddle-quest`, after checking the deployed versions above. Runtime tags distinguish `jest-html5` from `firebase-functions`.

- `RIDDLE-QUEST-42` affected the `1cea57fe0d71` preview's presence initialization. Its stack reaches `getDatabase(firebaseApp)` before the optional presence preference is checked. The RTDB dependency resolved Firebase app `0.16.2`, while the portal's Firebase 13.4.0 app resolves `0.16.7`, causing provider lookup to use different app registrations. A narrow package extension supplies RTDB's missing app peer. Browser/native now use their caller's `0.16.7`; Functions retains `0.16.2`. Real SDK construction failed before the change and passes afterward in all three scopes and a compiled browser fixture. All 242 release-script checks and the actual Node 22 Functions fixture passed.
- `RIDDLE-QUEST-40` and `RIDDLE-QUEST-41` are paired reports from the older `038397879804` preview. The official SDK's payments source identifies a negative incomplete-purchase response, rather than a changed successful response shape. The SDK boundary reports the failure, and the recovery hook reported it again after wrapping the result. The correction removes that second report, retains SDK and authoritative-grant reporting, and reports pagination exhaustion at its coordinator origin. It does not change grant-before-completion ordering or discard unsettled purchases. The fresh current-preview account reads both succeeded, as recorded above.
- `RIDDLE-QUEST-43` and `RIDDLE-QUEST-3X` contain structured App Check `throttled` diagnostics with HTTP 403 on older previews. `RIDDLE-QUEST-2K` is an older-preview subscription-sync `TypeError` with no retained stack. These observations do not establish a current-preview reproduction.
- `RIDDLE-QUEST-11`, `RIDDLE-QUEST-14` and `RIDDLE-QUEST-18` reference the older scheduler revision `dailychallengescheduler-00054-fix`. The deployed revision is `dailychallengescheduler-00056-kax`; their latest events predate this rollout. No new backend change was made from those stale events. A successful future scheduled run remains separate evidence from the revision check.

## Corrected game artifact and real retest

The Firebase and purchase-reporting changes were committed and pushed as `3dc4199da74dccf4872d64a61f0c0243bddb7b73`, then merged and pushed to the Android branch. Jest processed version `1.0.0-dev.20261122233052.3dc4199da74d.e98880bf`, ID `01a20599-61a7-716e-a72b-b6e1a90dfae5`, as READY and inactive. Its ZIP contains 89 entries and has SHA-256 `d5ff09b0879ace98a48f3a7e2981e6cabfb26a61964b91cef533d7a94e89bda4`. The hosted artifact has 88 files, occupies 4.12 MiB, and passes the unchanged artifact limits and HTML validator.

The actual hosted `vendor-firebase-Ckce6TbD.js` is 414,584 bytes with SHA-256 `835297a6cdd9d73a468fcdfcb4b986c01b84d5f70f949cca5882faed06765b76`. It contains app `0.16.7` and excludes the server-only `0.16.2` that appeared in the broken browser chunk.

Both isolated Firefox accounts loaded this exact artifact in English and recovered their 3,800-coin balances. A fresh human match synchronized both players' correct CANDLE answers. Account B quit; A received exactly one 50-coin win reward. A then solved Daily WHEAT for 180 coins and Classic COMPASS for 45 coins, used Next Level, and reloaded with 4,075 coins and the next Classic riddle retained. B reloaded with 3,800 coins. Read-only SDK recovery checks succeeded for both with zero unsettled purchases and a signed envelope. No receipt/signature contents were recorded.

Later indexing exposed one provider-negative incomplete-purchase event on this release at 23:37:43 UTC and one subscription-sync network `TypeError` at 23:38:04 UTC during reload checks. Subsequent reads succeeded. These remain observable; the duplicate wrapper report is absent. No `RIDDLE-QUEST-42` event from the corrected release was found. Aggregate issue counts and last-seen timestamps also include older previews, so release-filtered event tags were checked individually before making these statements.

The final follow-up adds one bounded retry for the SDK's exact negative incomplete-purchase response and for a `TypeError` thrown directly by native fetch during subscription synchronization. Both attempts share the original 15-second or 30-second deadline. No HTTP error, JSON parsing failure, entitlement projection, checkout, purchase grant or completion is retried by this change. Final failure remains reported. All 148 focused adapter/backend checks passed, including exhausted and late failures, unchanged signed proof/controller, and exclusions; portal types and TSDoc passed. These checks verify the follow-up code; the final uploaded-artifact observations are recorded below.

## Completion fields

- Replacement Jest upload: **pending**. Record the corrected source commit, immutable version, version ID, upload processing result and exact preview URL. Keep it inactive unless activation is explicitly requested.
- Sentry reading and repair service: **pending**. Record the deployed service identity, authenticated read check, deployed-version gate, scheduled/webhook processing verification and repair permissions.
- Final verification: **pending**. Record the Firebase peer-alignment checks, corrected artifact build, current-preview browser retest and post-retest Sentry observations. The checks above describe their named artifacts and must not be relabelled as verification of a later upload.
