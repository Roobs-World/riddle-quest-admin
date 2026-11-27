# Review Riddle Quest Testing version 15

This handoff is for developer-role testing of Riddle Quest on 27 November 2026. Version 15 is in **Testing**. Review completeness remains unproven. No review submission, Production promotion, or publication is recorded for this candidate.

Use the [API submission checklist](facebook-api-submission-checklist-2026-11-27.md) as the authoritative record of coverage, prerequisites, and acceptance journeys. The [September handoff](facebook-review-draft-2026-09-19.md) is historical and does not describe this candidate's current configuration.

## Select the exact candidate

1. Open Meta's Web Hosting page for Riddle Quest, app `1748953042991569`, with an authorized developer-role account.
2. Confirm that the Testing row is version **15**, bundle `30470981679157112`, with processing complete.
3. Confirm that its SDK selector is **8.0 [Network Enabled Zero Permissions]**.
4. Launch that Testing candidate. Do not select Production as a substitute.

The uploaded source is clean `66de0e9da202b5889da5bbf1dd54a98b03bb6bc0` on `facebook`. The archive SHA-256 is `5803b051ff965b97b7ea1e8669d816172983a7c7a1ae8ab8a44ba9a630cbf824`, with 2,865,675 bytes, 422 ZIP entries, and 420 runtime files. Canonical upload preflight passed. The archive was uploaded once, finished processing, and was explicitly assigned to Testing. Meta's independently downloaded archive matched the recorded hash and byte count, and the local acceptance receipt was recorded. See the [exact version 15 acceptance record](evidence/facebook-testing-version-15-2026-11-27.json).

Production remains version 9, bundle `29168977262783270`. The permission-specific query reports BASIC standard access for developer-role testing, with advanced access absent. This does not establish public availability or product-review approval. See the [role-access follow-up](evidence/facebook-role-access-followup-2026-11-27.json).

## Reproduce the version 15 desktop check

1. Launch the exact Testing candidate and allow startup to finish. Select **Let's Play** if the Riddle Quest welcome screen appears. The original recorded launch was slow and displayed that welcome; later relaunches restored play directly.
2. Confirm the expected account's saved Classic progress and balance. The latest recorded state for this test account is the **kettle puzzle and 1,035 coins**. Coconut and 920 coins were the starting state before the later three-win ad check; do not reset progress to reproduce those historical values.
3. Open **Settings**. In the recorded desktop check, no native banner appeared; the banner layout and banner recovery element counts were both zero.
4. Close Settings. Confirm that **Settings**, **Multiplayer** and the first answer cell are enabled, with the balance unchanged from step 2.

The [native version 15 banner evidence](evidence/facebook-native-banner-version-15-2026-11-27.md) establishes narrow **H15** startup and graceful inactive-banner fallback. A subsequent read-only IGDebug SDK Info check advertised `hideBannerAdAsync` but omitted `loadBannerAdAsync`, directly failing the existing paired-method guard. No banner request/result, no-fill response, served impression or successful native hiding was observed. J10 still requires a host advertising both methods and satisfying the other gates; native banner acceptance remains open. See the [49-name capability record](evidence/facebook-native-sdk-capabilities-version-15-2026-11-27.json).

The [banner activation record](evidence/facebook-banner-activation-2026-11-27.md) identifies the new menu space `1831460568074149` and placement `1748953042991569_1831460981407441` under existing property `957348766757902`. The placement showed **Ready to publish** both before and after the desktop check. The accepted artifact contains `VITE_FACEBOOK_BANNER_ENABLED=true` and that exact placement ID; its archive scan found no Qwordly text. This establishes client activation and placement setup, not served-ad acceptance or provider approval.

Local banner/configuration verification passed 20 tests across two suites in 0.257 seconds. The full real-entry browser journey passed in 33.923 seconds using external SDK/network fixtures: Settings geometry, hide-before-dialog ordering, return after cancellation, gameplay hiding and no-fill recovery were checked. Canonical preflight and artifact audit passed with 420 runtime files, 4.51 MB total and 0.71 MB initial resources, without Jest gaming-platform SDK, native-module or credential leakage. These local results do not replace native J10 acceptance. Firebase remains unchanged.

## Additional version 15 desktop verification

The [version 15 Settings and save evidence](evidence/facebook-native-settings-version-15-2026-11-27.md) records real native Privacy/Terms confirmations followed by **Go back**, with controls restored. Reduced motion **On** persisted across Quit/relaunch; its original **Off** state was restored and persisted across a second Quit/relaunch. The final coconut puzzle and balance remained 920 coins. Host Collapse/Expand changed the rendered display mode **normal → expanded → normal**, with usable controls.

One initial relaunch navigation timed out while the Games landing remained visible. Relaunching from the exact candidate row succeeded but briefly showed a service-unavailable message before recovering without another reload. The second relaunch restored the game normally. The underlying service cause was not captured; do not describe startup as uniformly error-free or infer cross-device saves from this same-account check. These Settings checks do not establish commerce, social sends, subscriber rules or mobile behavior.

## Version 15 native social and ad follow-up

The [current-candidate social and ad evidence](evidence/facebook-native-social-ads-version-15-2026-11-27.md) adds the following H15 observations:

1. Profile Invite and the separate Play with friends context chooser opened native surfaces and cancelled without selecting recipients. Controls returned. Play on Facebook showed zero friends and no listed tournaments; Choose friends failed visibly and remained hidden after Refresh. No accepted context, Room or tournament join is established.
2. A native rewarded video completed to 100; closing its completed end card restored seven editable answer cells with **920 coins unchanged**. Fresh subscription-gate success is inferred through the reviewed client; no direct entitlement request trace or live subscriber acceptance is claimed.
3. Three unique Classic wins earned ordinary rewards of **35, 25 and 55 coins**. A native interstitial appeared on the third held result. Close ad returned to the result with Next Level and Share enabled. The completed-result Share composer also cancelled without publishing.
4. Quit/relaunch restored the next kettle puzzle with **1,035 coins**, without a duplicate reward. Reduced motion remained Off and gameplay controls were enabled.

One initial guess submission refreshed the current puzzle; its request-level cause was not captured. A later apparent input stall was traced to the Meta IGDebug panel covering the controls; closing it immediately restored editing. Neither observation justifies a speculative source fix. These checks used the real desktop host without SDK/network fixtures. No Firebase source, configuration or deployment changed, and no new upload or provider setting was needed. Ad failure variants, caps, live subscriber suppression, mobile behavior, social delivery, purchases and native banners remain open.

## Retained version 14 desktop check

The following **H14** observations belong to source `61fc18b0a3df0d6efd69b2b28eb1eeb3abb8e24f`, bundle `30477676368485685`, archive SHA-256 `d44c2e9b59b9eea398d8bdd0382149898161a2726bad8ec2d8289a1bb0cae03d`. See the [version 14 acceptance record](evidence/facebook-testing-version-14-2026-11-27.json). The separate version-15 follow-up above now repeats legal-link cancellation and quit/relaunch; the original H14 record retains its historical scope.

1. Launch the exact Testing candidate and allow startup to finish. The recorded initial launch was slow but restored the Classic coconut puzzle with 920 coins.
2. Open **Settings**, then **Privacy Policy**. Confirm that Meta's native confirmation identifies Riddle Quest and `https://roobsworld.com/riddle-quest/privacy`.
3. Select **Go back**. Confirm that Settings controls respond again.
4. Select **Terms of Use**. Confirm that Meta's native confirmation identifies Riddle Quest and `https://roobsworld.com/riddle-quest/terms`, then select **Go back**. Confirm that controls respond again.
5. Select **Quit game**. The recorded native exit navigated to Facebook Gaming.
6. Relaunch the same version 14 Testing candidate. Confirm that the same coconut puzzle and 920 coins return, with **Settings** and **Multiplayer** enabled.

The [native version 14 evidence](evidence/facebook-native-settings-version-14-2026-11-27.md) records this historical desktop check. These are narrow **H14** observations. No native purchase, live account replacement or eligibility-timeout fixture was exercised, and no new rewarded-ad test was performed. H12, H13 and H14 retain their original candidate scopes.

Version 14 adds the [Settings preparation and checkout ownership corrections](evidence/facebook-native-action-lifetimes-2026-11-27.md). Bounded Settings eligibility preparation passed 39 focused tests across two suites. The real built-entry commerce regression and existing integrated browser journeys passed in 33.233 seconds after the corrected polling fixture established a failing old-entry run. The upload preflight and artifact audit passed with 420 runtime files, 4.51 MB total and 0.71 MB initial resources, without Jest gaming-platform SDK, native-module or credential leakage. Local timeout and account-replacement fixtures do not establish those outcomes on the native host. Purchase recovery and native-dialog ownership remain unchanged; commerce remains disabled. Firebase backend source, configuration and provider server modules were not changed or deployed.

## Retained version 13 desktop check

The following **H13** observations belong to source `738d32a5b2628397d6ba365698d8c9abbd821358`, bundle `29536858815945546`, archive SHA-256 `4f0f61b92bc08c9170bc6c4ec5dae0982cfc57e525511158b8969fba8e96c1cf`. See the [version 13 acceptance record](evidence/facebook-testing-version-13-2026-11-27.json). The separate version-15 follow-up above now repeats the rewarded nonsubscriber path; this H13 record retains its historical scope.

1. Launch the exact Testing candidate and allow startup to finish. The recorded desktop launch was slow but restored the Classic coconut puzzle with 920 coins. Select **Let's Play** if the welcome dialog appears.
2. Reach an eligible Classic loss state. The recorded check used five incorrect seven-letter guesses without spending coins.
3. Select **Watch an ad for another attempt**. Allow the real native video to reach completion. In the recorded check its progress reached 100; the completed end card's X control was labelled **Skip ad**.
4. Close the completed end card. Confirm that the loss dialog disappears, seven answer cells become editable, **Multiplayer** is enabled and the balance remains 920 coins. The continuation did not award coins.

This was a real developer-role desktop session without SDK replacement, network fixtures or runtime patches. The [native version 13 evidence](evidence/facebook-native-subscription-version-13-2026-11-27.md) records the observed outcome. The reviewed code requires fresh subscription eligibility before acquisition and display, so the successful native video implies those gates succeeded for this nonsubscriber. A direct nested-frame GET/status/header trace was not captured. No live subscriber account or subscription-field mutation was tested; do not describe this observation as native subscriber acceptance.

Version 13 introduced the [client subscription ad gate](facebook-ad-eligibility.md), retained in version 15, to compensate for the legacy configuration endpoint's omission. The version 13 correction passed 122 focused tests across seven suites, shared TypeScript checking, the integrated injected-SDK browser journey in 30.907 seconds, and `pnpm preflight:facebook-upload`. Its artifact audit covered 420 files, 4.51 MB total and 0.71 MB initial resources, with no Jest gaming-platform SDK, native modules or credential leakage. Controlled subscriber fixtures proved suppression, retry recovery and a subscription change during held native loading; those local results are separate from the nonsubscriber host check. See the [local correction evidence](evidence/facebook-subscription-ad-gate-2026-11-27.md). Firebase backend source, configuration and provider server modules were not changed or deployed.

## Retained version 12 desktop regression checks

The following observations are historical **H12** evidence for source `8e3b7d2ef942ea387e7370c23ff4f1c1448fa108`, bundle `29781063778191740`, archive SHA-256 `a2780de4ed9ac7856f447b4f19d6d7940c0b5067ba87c2436b4fcab524ddac28`. They are useful regression procedures for version 15, but have not all been repeated on it. See the [version 12 acceptance record](evidence/facebook-testing-version-12-2026-11-27.json).

1. Allow Facebook startup and account restoration to finish. The recorded session restored the account's saved Classic loss state without a separate game password.
2. In an eligible Classic loss state, select the rewarded-video action for another attempt. Allow the native video to finish, then close its completed end card.
3. Confirm that the loss dialog closes and answer entry becomes available. In the recorded check, seven editable cells returned and the balance remained 625 coins. The continuation did not award coins.
4. Open **Settings**, then **Privacy Policy**. Confirm that Meta's external-link prompt names `https://roobsworld.com/riddle-quest/privacy`.
5. Select **Go back**. Confirm that Settings controls respond again and that returning to the game leaves **Multiplayer** enabled.
6. Set **Reduced motion** to **On**, select **Quit game**, and relaunch the same Testing candidate. Confirm that the preference remains On. Restore **Off**, quit, and relaunch again. Both saved states persisted in the recorded check. Sound returning to On follows the game's longstanding startup policy.
7. On an eligible host, select **Add to home screen**. Confirm that Meta opens **Save to Your games**, then cancel saving Riddle Quest. The recorded cancellation returned control and created no saved-game shortcut.
8. Complete unique Classic levels until an interstitial opportunity becomes eligible. Keep the result screen open while preparation settles. In the recorded session, immediately leaving the third win retired that opportunity. Holding the sixth win displayed a native interstitial.
9. Select **Close Ad**. Confirm that the victory screen returns and **Next Level** works. The recorded win showed its ordinary 55-coin reward; no ad reward was claimed.
10. Select **Invite a friend**. Confirm that the native dialog identifies Riddle Quest, then select **Close** without choosing a recipient. The recorded cancellation sent no invitation. Closing Profile restored the game with **Multiplayer** enabled.
11. Toggle the host's **Collapse** and **Expand** controls. In the recorded check, Collapse changed the game's `data-facebook-display-mode` from `normal` to `expanded`; Expand restored `normal`. Game controls remained enabled. This verifies the visible mode-change path, not an independent trace of each SDK method.
12. Open **Settings**, then **Terms of Use**. Confirm that Meta's prompt names `https://roobsworld.com/riddle-quest/terms`, then select **Go back**. The recorded cancellation restored enabled Terms and Quit controls.
13. Complete a Classic puzzle and select **Share** on its result. Confirm that the native **Share game** composer contains Riddle Quest result copy. Close the composer without selecting an audience or sending. The recorded cancellation restored **Share** and **Next Level**; advancing returned to gameplay.
14. Open **Race to 10**, then **Play on Facebook**. The recorded session showed **Friends who play** as 0 and an empty **Facebook tournaments** list. **Choose friends** returned **Service temporarily unavailable** and disappeared; **Refresh** did not restore it. No raw SDK error code was captured, so this establishes failure and action retirement only.
15. Use the separate **Play with friends** action. Close its native context chooser without selecting anyone. The recorded cancellation restored enabled **Play with friends** and **Start PvP** controls. Closing the lobby returned to gameplay with **Multiplayer** enabled.

These version 12 observations used the real desktop Meta host without SDK replacement or native-result fixtures. They establish the specific startup, save, ad, display, legal-link, and social outcomes recorded above. They do not establish every failure path, entitlement rule, session cap, or mobile-host behavior. Empty counts and listings do not establish matches with other players, tournament joining, or Rooms.

The earlier native follow-up ended with 885 coins after normal gameplay. One subsequent Classic win awarded its ordinary 35 coins, bringing the balance to 920. Sharing and context cancellation added no rewards. See the [initial client review](evidence/facebook-client-review-2026-11-27.md), [first native follow-up](evidence/facebook-native-followup-version-12-2026-11-27.md), and [host and social follow-up](evidence/facebook-host-social-followup-version-12-2026-11-27.md).

The version 12 candidate also passed 136 focused tests across nine suites, shared typecheck, the combined local browser journey, and `pnpm preflight:facebook-upload`. The artifact audit found no Jest gaming-platform SDK, native modules, or credential leakage. Jest unit-test tooling is unrelated to the gaming-platform SDK. Local fixture results do not establish native host support.

## Continue the outstanding reviewer journeys

Record each new result against version 15, the actual host, and the account's eligibility. Keep unsupported, cancelled, failed, and completed results separate. Use the checklist's full J01–J14 procedures for failure paths and account retirement.

1. Check save failure, interrupted reward delivery, and duplicate-reward prevention. The accepted preference save-and-quit check does not establish these failure paths.
2. Verify follow-page and join-group eligibility and cancellation independently. Successful shortcut creation remains separate from the recorded cancellation.
3. With consenting testers on eligible hosts, complete context creation, matchmaking, and the authorized recipient side of social journeys. Counts are not an online-player directory. The recorded **Choose friends** failure and separate **Play with friends** cancellation do not establish successful context membership or co-play.
4. With consenting testers and an eligible tournament, join from the native list. Confirm that the game opens the matching official board only after validating the fresh native tournament data. Tournament routing and cancellation passed locally; native version 15 acceptance remains open.
5. Check ad failure and cancellation paths, authoritative subscription suppression, durable interstitial removal, cooldowns, and session caps on eligible hosts. The completed version 13 rewarded video and historical version 12 interstitial do not establish these cases.
6. Repeat applicable journeys on a supported native mobile host. Check pause and resume, dialogs, available profile overlays, and optional haptics or session-score actions. A resized desktop browser is not mobile-host evidence.
7. Use separate authorized accounts to check save isolation, retired operations, and account cleanup. Verify the server-owned outcomes separately. No account-deletion or purchase-recovery acceptance is claimed here.

Invitations, chat posts, notification delivery, purchases, and refunds need explicitly scoped test actions and eligible participants. This handoff does not authorize sending or spending.

## Keep conditional features out of acceptance claims

The [dashboard prerequisite record](evidence/facebook-dashboard-api-prerequisites-2026-11-27.md) and the checklist distinguish source wiring from a usable provider integration.

- Commerce is disabled. The seven-product catalog exists, but payout setup, IAP approval, V2 payment callback acceptance, signed purchase verification, refunds, and recovery remain open. Do not describe this candidate as purchase-ready.
- The banner flag and dedicated placement are enabled in version 15. The placement remains Ready to publish. The inspected desktop SDK advertises hide but omits load, so the existing paired-method guard correctly omits the banner adapter. Supported-host J10 acceptance and provider readiness remain open; this is not a no-fill or served-impression result.
- Messenger bot permission is disabled by default. Bot Review is Not Submitted, and the required `pages_messaging` access and use case are unresolved. This permission is separate from the game's notification-manager preference.
- Private tournaments are disabled by default. App allowlisting, player rollout, an eligible Messenger group, and compatible higher-is-better scoring settings remain unverified.
- Rooms needs an eligible live Messenger Rooms match. No accepted native Room join is recorded.
- The Riddle Quest App Page is linked. Group association and player-specific community eligibility remain unverified.
- Profile overlays, haptics, session-score variants, and other optional actions depend on the real host's advertised APIs and callable methods. The recorded desktop host did not expose all of these families.

## Resolve the six API gaps

The [current API inventory](facebook-api-research-2026-11-27.md) and checklist cover 79 documented entry points. These six remain gaps:

- `FBInstant.switchGameAsync` needs a real configured destination and a meaningful Riddle Quest product workflow.
- `player.getASIDAsync` needs an eligible legacy identity and an authoritative migration contract.
- `player.getSignedASIDAsync` needs that migration contract and trusted signed-identity verification.
- `player.getAssociatedAppsASIDAsync` needs a genuine same-game app association and an authoritative account-link contract.
- `player.getSignedAssociatedAppsASIDAsync` needs that association and trusted signed-identity verification.
- `player.createNEZPNotificationContentAsync` needs manager-authored content, a receipt bound to the current generation, a dispatch consumer, and trusted verification or manager approval. A browser-returned content ID alone cannot authorize a campaign.

Cross-Play Management is Not Linked. Do not invent a destination, associated app, identity merge, or notification authority to close a checklist row. Firebase, its configuration, and provider server modules remain preserved under the owner's instruction. Backend readiness remains a separate acceptance requirement.

## Reconcile review prerequisites before submission

Business Verification is Verified and In App Ads is Approved. Those statuses cover only their named requirements. Approved Partner Program, Policy, Quality, In App Purchases, Bot, and App Property are Not Submitted in the recorded dashboard state. Policy and Quality submission controls are disabled.

The permission-specific Zero Permission Access query reports `standard_access: true`, `advanced_access: false`, and tier `BASIC`. Its aggregate privilege still reports `is_live: false`, `is_rejected: true`, `grant_status: REJECTED`, and `access_level: none`. BASIC role-account access and the unresolved public-access status must remain distinct.

The connector reports App Review as UNSUBMITTED while its requirements report a previous review in progress. The new history query returns no submissions and `has_been_previously_reviewed: false`, although the permission query reports `in_current_submission: true`. Preserve these conflicting responses without inferring a pending or approved review. See the [original review state](evidence/facebook-live-review-state-2026-11-27.json) and the [permission-specific follow-up](evidence/facebook-role-access-followup-2026-11-27.json).

[Read-only deployment metadata](evidence/facebook-deployed-authority-2026-11-27.md) confirms 32 selected functions are active on `nodejs22`, with latest-revision traffic and the Riddle Quest Facebook app binding. No function was invoked or Firebase setting changed. This does not establish source-commit correspondence, every shared endpoint, account entitlements, signed receipts, idempotency, callback delivery, or notification dispatch. Full backend acceptance remains open.

The subsequent [deployed source comparison](evidence/facebook-deployed-source-comparison-2026-11-27.md) found that all three downloaded representatives differ from the protected baseline. The active configuration source lacks subscription-based ad suppression, and version 12 relied on its returned ad booleans. Version 13 independently reads the authenticated account's existing server-owned subscription field and combines it with those configuration flags. Local subscriber tests and the native nonsubscriber rewarded path passed; live subscriber acceptance remains open. No live subscriber harm was observed, and durable interstitial removal remains present. This is a client correction: the preserved Firebase backend has not been repaired or redeployed.

Before submission, complete the applicable native journeys, verify deployed server behavior without changing the preserved Firebase backend, resolve the missing product and provider prerequisites, and confirm current legal, age, support, and retention disclosures. Production promotion, review submission, and publication each remain separate authorized actions.
