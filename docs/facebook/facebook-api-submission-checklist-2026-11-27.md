# Facebook API submission checklist — 27 November 2026

**Status: version 15 is in Testing; submission completeness is unproven.** This checklist covers every one of the 79 public SDK entry points in the [current primary-source inventory](facebook-api-research-2026-11-27.md). The uploaded source is `66de0e9da202b5889da5bbf1dd54a98b03bb6bc0` on the owner-requested `facebook` branch. Exact archive identity and narrow desktop/physical Android observations are recorded below; they do not establish approval or acceptance of every integration. Later source changes require their own artifact and host checks.

The scope remains every possible applicable API integration. An absent adapter, missing configuration, missing product surface or missing partner approval is an open item, not a completed integration. Alternative APIs are tracked individually even when one real workflow deliberately selects only one of them. Removed or deprecated unavailable APIs are distinguished at the end.

## Authoritative evidence and status

- [Prerequisite follow-up](evidence/facebook-prerequisite-followup-2026-11-27.md): fresh connector permission/review discrepancies, six workflow prerequisites and payment/tournament limits; product dashboard views were not freshly rechecked. Current testing remains single-account.
- [Dashboard prerequisites](evidence/facebook-dashboard-api-prerequisites-2026-11-27.md): current product-specific hosting, review and cross-play observations.
- [Connector review JSON](evidence/facebook-live-review-state-2026-11-27.json): app-review status, requirements and individual privileges. There is no separate dashboard-prerequisites JSON.
- [Permission-specific role-access follow-up](evidence/facebook-role-access-followup-2026-11-27.json): Zero Permission Access reports BASIC standard access and no advanced access, while aggregate privilege and review-history fields remain inconsistent.
- [Selected deployed authority metadata](evidence/facebook-deployed-authority-2026-11-27.md): read-only metadata confirms revisions and selected non-secret configuration for 32 active functions. No function was invoked; full backend acceptance remains open.
- [Deployed source comparison](evidence/facebook-deployed-source-comparison-2026-11-27.md): three downloaded representatives differ from the protected baseline. The active configuration source lacks subscription-based ad suppression; version 13 adds an independent client read of the existing server-owned subscription field. No live subscriber harm was observed. Firebase remains preserved.
- [Subscription ad gate correction](evidence/facebook-subscription-ad-gate-2026-11-27.md): 122 focused tests across seven suites, the integrated injected-SDK browser journey in 30.907 seconds, security review and canonical upload preflight passed. Controlled subscriber fixtures are separate from native host acceptance.
- [Exact version 15 acceptance record](evidence/facebook-testing-version-15-2026-11-27.json): Testing bundle `30470981679157112`, clean source `66de0e9da202b5889da5bbf1dd54a98b03bb6bc0`, SHA-256 `5803b051ff965b97b7ea1e8669d816172983a7c7a1ae8ab8a44ba9a630cbf824`, 2,865,675 bytes. Canonical preflight passed; uploaded once, processed and explicitly assigned to Testing. Independent provider download hash and bytes matched, and local acceptance was recorded. Production remains version 9.
- [Native version 15 SDK capabilities](evidence/facebook-native-sdk-capabilities-version-15-2026-11-27.json): Meta’s rendered IGDebug SDK Info listed 49 names, including `hideBannerAdAsync` and excluding `loadBannerAdAsync`. This identifies the failed advertised-method requirement without forcing an SDK call. The list is neither execution evidence nor approval or global/mobile availability.
- [Physical Android version 15 check](evidence/facebook-android-host-version-15-2026-11-27.md): Galaxy S22/Android 16/Facebook 588.0.0.42.55 loaded the exact bundle, restored the kettle puzzle and 1,035 coins, cancelled the native Privacy Policy confirmation, and returned from Home/Recents to the same game task with working input. The [mobile SDK list](evidence/facebook-android-sdk-capabilities-version-15-2026-11-27.json) contains 47 names; banner load and haptics are absent. Shortcut methods are advertised but no Settings action appeared, leaving eligibility unestablished. No preference change, opt-in or mobile ad/social/purchase acceptance is implied.
- [Native version 15 Settings, saves and display modes](evidence/facebook-native-settings-version-15-2026-11-27.md): Privacy/Terms cancellation restored controls; Reduced motion On and restored Off each persisted across quit/relaunch. Host Collapse/Expand changed the rendered mode normal → expanded → normal. That Settings check preserved the coconut puzzle and 920 coins before the later Classic wins below. One relaunch briefly showed a service error before the existing automatic recovery restored play; its request-level cause was not captured.
- [Native version 15 social cancellation, ads and progress](evidence/facebook-native-social-ads-version-15-2026-11-27.md): Profile Invite, context chooser and result Share cancellation restored controls without sending. Discovery showed zero friends and an empty tournament list; Choose friends failed visibly and retired through Refresh, with no raw SDK error code captured. A completed rewarded video restored seven editable cells without changing 920 coins. Three unique Classic wins earned ordinary rewards; the held third result displayed an interstitial and recovered after dismissal. Quit/relaunch restored the next kettle puzzle and 1,035 coins without another reward. These are narrow desktop nonsubscriber outcomes, not social joins/delivery, subscriber suppression or full ad-policy acceptance.
- [Native version 15 banner follow-up](evidence/facebook-native-banner-version-15-2026-11-27.md): slow startup reached the Riddle Quest welcome screen; Let's Play restored the coconut puzzle and 920 coins. Settings showed no native banner, banner layout or recovery element. Closing Settings left Settings, Multiplayer and the first answer cell enabled, with 920 coins unchanged. This is H15 startup and graceful inactive-banner fallback. A later rendered IGDebug check advertised hide but omitted load, directly failing the banner admission guard; no native no-fill, impression or hide success is claimed.
- [Historical version 14 acceptance record](evidence/facebook-testing-version-14-2026-11-27.json): accepted then-Testing bundle `30477676368485685`, SHA-256 `d44c2e9b59b9eea398d8bdd0382149898161a2726bad8ec2d8289a1bb0cae03d`, 2,865,660 bytes. Canonical preflight passed; uploaded once, processed and explicitly assigned to Testing. Independent provider download hash and bytes matched, and local acceptance was recorded. Production remains version 9.
- [Historical version 14 Settings and quit/relaunch](evidence/facebook-native-settings-version-14-2026-11-27.md): slow initial startup restored the coconut puzzle and 920 coins; native Privacy Policy and Terms confirmations identified Riddle Quest and the fixed roobsworld.com destinations. Go back cancellations restored controls. Quit navigated to Gaming; relaunching the same candidate restored the same puzzle and balance with Settings and Multiplayer enabled. No native purchase, live account replacement, eligibility-timeout fixture or new rewarded-ad test was performed.
- [Historical version 13 acceptance record](evidence/facebook-testing-version-13-2026-11-27.json): accepted then-Testing bundle `29536858815945546`, SHA-256 `4f0f61b92bc08c9170bc6c4ec5dae0982cfc57e525511158b8969fba8e96c1cf`, 2,865,505 bytes. Its evidence retains that exact candidate scope.
- [Historical version 13 subscription-gated continuation](evidence/facebook-native-subscription-version-13-2026-11-27.md): slow startup restored the Classic coconut puzzle and 920 coins; a real rewarded video completed and returned seven editable cells without changing coins. Fresh entitlement acceptance for this nonsubscriber is inferred through the reviewed display gates; a direct nested-frame GET/status/header trace and live subscriber check were not obtained. Version 15 now has a separate rewarded-continuation observation; this record retains its H13 scope.
- [Recorded version 9 upload](evidence/facebook-campaign-activation-2026-11-26.json): source `af20085bce70fbe73aedebce68975a414d9dac20`, archive SHA-256 `11b614b7c7d483041b689c5ba9750468da37a3a6a5824b7e85f4369eca99dcca`.
- [Hosted rewarded continuation](evidence/facebook-rewarded-ad-setup-2026-11-27.md): one real version-9 video and successful continuation; not the new ad cadence, subscriber policy or new candidate.
- [Payment configuration and deployment evidence](evidence/facebook-payments-catalog-2026-11-27.md): catalog exists; payout, approval, webhook readiness and checkout activation remain open.
- [Expanded API build](evidence/facebook-expanded-api-build-2026-11-27.md): the first completed candidate unit built after session-score wiring, with 418 files, 4.48 MB total and 0.69 MB initial resources; hosted acceptance remains open.
- [Combined expanded candidate verification](evidence/facebook-expanded-api-final-verification-2026-11-27.md): 398 focused tests, the expanded local browser journey and backend preflight passed. The production build contains 420 files, 4.50 MB total and 0.70 MB initial resources.
- [Earlier testing uploads and hosted smoke checks](evidence/facebook-client-testing-2026-11-27.md): version 11's desktop picker correction and native chooser cancellation passed. Version 10 records earlier startup, legal-link cancellation and social discovery. Their archive identities remain recorded; both are now Standby. Firebase remains unchanged by explicit owner instruction.
- [Historical version 12 acceptance record](evidence/facebook-testing-version-12-2026-11-27.json): accepted then-Testing bundle `29781063778191740`, SHA-256 `a2780de4ed9ac7856f447b4f19d6d7940c0b5067ba87c2436b4fcab524ddac28`, 2,864,259 bytes. Production remains version 9.
- [Client integration review](evidence/facebook-client-review-2026-11-27.md): version 12 includes tournament routing, Settings ownership and bounded ad-preparation corrections. All 136 focused tests and the combined browser journey passed. Exact-host startup, a completed real rewarded video/continuation and privacy-link cancellation passed.
- [Native version 12 follow-up](evidence/facebook-native-followup-version-12-2026-11-27.md): Reduced motion survived native quit/relaunch and was restored; shortcut and invitation cancellation returned control; a real interstitial displayed on a held qualifying result and returned to gameplay. These are desktop developer-role observations, not full J01–J14 acceptance.
- [Version 12 host and social follow-up](evidence/facebook-host-social-followup-version-12-2026-11-27.md): native display-mode changes reached the game; Terms, result-share and context-chooser cancellation returned control. Choose friends failed visibly and retired. Zero friends and an empty tournament list do not establish successful joins, matches or Rooms.
- [Current reviewer handoff](facebook-review-draft-2026-11-27.md): exact version 15 steps, retained historical H12/H13/H14 regression procedures, enabled behavior and remaining prerequisites; the September draft is historical.
- [Published disclosures check](evidence/facebook-published-disclosures-2026-11-27.md): the fixed privacy and terms pages loaded and identify Riddle Quest, its publisher/support route, Facebook audience restrictions and conditional features. This is a content check, not legal approval or proof of operational retention compliance.
- [Banner setup and activation](evidence/facebook-banner-activation-2026-11-27.md): dedicated menu space `1831460568074149` and Banner placement `1748953042991569_1831460981407441` were created under existing property `957348766757902`. Ready to publish was observed before and after the version 15 desktop check. The accepted artifact contains the true banner flag and exact ID, with no Qwordly text. Local verification passed 20 tests across two suites in 0.257 seconds and the full real-entry browser journey in 33.923 seconds; geometry, dialog ordering, cancellation, gameplay hiding and no-fill used external fixtures. Native banner acceptance remains open.
- [Returned-object source audit](evidence/facebook-returned-object-coverage-2026-11-27.md): all six Tournament getters and both LiveMatch getters have reachable consumers. Real eligible joins and private-tournament prerequisites remain separate.
- [Native action lifetime corrections](evidence/facebook-native-action-lifetimes-2026-11-27.md): version 14 includes bounded Settings eligibility preparation, which passed 39 focused tests across two suites, and captured account ownership, which passed the real built-entry browser regression in 33.233 seconds after a confirmed failing old-entry run. Exact-archive acceptance and the narrow H14 host check are recorded separately; native timeout, account-replacement and purchase acceptance remain unproven.
- [Earlier source coverage](evidence/facebook-api-coverage-2026-11-27.md): historical baseline, superseded by this checklist's broader scope for future work.

| Code | What the evidence establishes |
| --- | --- |
| W | Source implementation and its entry/UI wiring were inspected. Exact-artifact and supported-host evidence are tracked separately; this code alone is not acceptance. |
| C | Implementation is wired conditionally but provider/deployment prerequisites prevent claiming an active integration. |
| G | Integration gap: no reachable implementation or complete meaningful workflow was found. |
| H9 | Narrow historical hosted observation in version 9 only. Every changed flow still needs final-candidate acceptance. |
| H12 | Narrow historical hosted observation on exact version 12; it does not certify version 15 or other journeys. |
| H13 | Narrow historical startup and rewarded-continuation observation on exact version 13 for a nonsubscriber. It does not certify version 15; direct entitlement network tracing, live subscriber behavior and other journeys remain separate. |
| H14 | Narrow historical startup, fixed legal-link cancellation and quit/relaunch observation on exact version 14. It does not certify version 15; native purchases, account replacement, eligibility timeouts and rewarded ads were not exercised. |
| H15 | Exact Testing version 15 desktop observations: startup/inactive-banner fallback; legal-link, Profile Invite, context chooser and result Share cancellation; empty social discovery and Choose friends failure; Reduced motion and Classic progress persistence; display-mode changes; nonsubscriber rewarded continuation and one interstitial after three unique Classic wins. One relaunch briefly showed a service error before recovery. Rendered SDK Info advertises banner hide but omits load. Physical Android additionally verified the exact bundle, saved puzzle/balance, Privacy Policy cancellation and Home/Recents return with recovered input; individual lifecycle callbacks were not traced. No social send/join, live subscriber suppression, native banner or broader mobile acceptance is implied. |

None of these codes means the final submission requirement is complete. The [combined candidate verification](evidence/facebook-expanded-api-final-verification-2026-11-27.md) covers the later private-tournament, Messenger-consent and generic-overlay additions. The owner explicitly authorized focused tests and browser verification on 27 November. All 398 focused tests and the expanded local injected-SDK browser journey passed. No fresh hosted acceptance is implied by source inspection or local checks. Version 13 introduced the separately recorded 122-test correction and narrow H13 observation. Version 14 adds the 39-test Settings correction, the actual-entry ownership regression and narrow H14 observations. Version 15 adds 20 banner/configuration tests, the 33.923-second integrated browser journey and narrow H15 observations. Earlier test totals and H12/H13/H14 results retain their original candidate scope.

## Source owners used in the matrix

All Facebook browser paths below are beneath `platforms/web/facebook/src/`:

| Owner | Canonical source |
| --- | --- |
| Bootstrap / entry | [FacebookPlatformBootstrap.ts](../../platforms/web/facebook/src/FacebookPlatformBootstrap.ts), [FacebookPlatformEntry.tsx](../../platforms/web/facebook/src/FacebookPlatformEntry.tsx) |
| Credential exchange / policy | [credentialExchange.ts](../../platforms/web/facebook/src/credentialExchange.ts), [FacebookCapabilityPolicy.ts](../../platforms/web/facebook/src/FacebookCapabilityPolicy.ts) |
| Lifecycle / analytics | [createFacebookLifecycle.ts](../../platforms/web/facebook/src/createFacebookLifecycle.ts), [analytics.ts](../../platforms/web/facebook/src/analytics.ts) |
| Host environment | [engagement/FacebookHostEnvironment.ts](../../platforms/web/facebook/src/engagement/FacebookHostEnvironment.ts) |
| Settings actions / haptics | [engagement/FacebookPlayerSettingsActions.ts](../../platforms/web/facebook/src/engagement/FacebookPlayerSettingsActions.ts), [engagement/FacebookHaptics.ts](../../platforms/web/facebook/src/engagement/FacebookHaptics.ts) |
| Session score | [engagement/FacebookSessionScore.ts](../../platforms/web/facebook/src/engagement/FacebookSessionScore.ts), [engagement/FacebookSessionScoreActions.tsx](../../platforms/web/facebook/src/engagement/FacebookSessionScoreActions.tsx) |
| Native social | [social/FacebookNativeSocial.ts](../../platforms/web/facebook/src/social/FacebookNativeSocial.ts), [social/FacebookNativeSocialPanel.tsx](../../platforms/web/facebook/src/social/FacebookNativeSocialPanel.tsx), [FacebookRaceEntry.tsx](../../platforms/web/facebook/src/FacebookRaceEntry.tsx) |
| Contexts / matching / updates | [contexts.ts](../../platforms/web/facebook/src/contexts.ts), [liveContextMatchmaking.ts](../../platforms/web/facebook/src/liveContextMatchmaking.ts), [contextChallenges.ts](../../platforms/web/facebook/src/contextChallenges.ts) |
| Referral / live sharing | [FacebookReferralSharing.ts](../../platforms/web/facebook/src/FacebookReferralSharing.ts), [FacebookLiveRaceSharing.ts](../../platforms/web/facebook/src/FacebookLiveRaceSharing.ts) |
| Tournaments / entry | [FacebookTournamentPresentation.ts](../../platforms/web/facebook/src/FacebookTournamentPresentation.ts), [facebookTournamentEntry.ts](../../platforms/web/facebook/src/facebookTournamentEntry.ts) |
| Ads / banner | [FacebookAdConfiguration.ts](../../platforms/web/facebook/src/FacebookAdConfiguration.ts), [ads/FacebookSubscriptionEntitlement.ts](../../platforms/web/facebook/src/ads/FacebookSubscriptionEntitlement.ts), [FacebookAdsCapability.ts](../../platforms/web/facebook/src/FacebookAdsCapability.ts), [FacebookLevelInterstitial.ts](../../platforms/web/facebook/src/FacebookLevelInterstitial.ts), [FacebookRewardedContinue.ts](../../platforms/web/facebook/src/FacebookRewardedContinue.ts), [ads/FacebookBanner.ts](../../platforms/web/facebook/src/ads/FacebookBanner.ts), [ads/FacebookBannerLayout.tsx](../../platforms/web/facebook/src/ads/FacebookBannerLayout.tsx) |
| Commerce / recovery | [FacebookCommerceSession.ts](../../platforms/web/facebook/src/FacebookCommerceSession.ts), [FacebookCommerceCapability.ts](../../platforms/web/facebook/src/FacebookCommerceCapability.ts), [FacebookPurchaseRecovery.ts](../../platforms/web/facebook/src/FacebookPurchaseRecovery.ts) |
| Profile overlays | [FacebookOverlayCapability.ts](../../platforms/web/facebook/src/FacebookOverlayCapability.ts) |
| Notification consent | [FacebookCampaignNotifications.ts](../../platforms/web/facebook/src/FacebookCampaignNotifications.ts); delivery/content remain with the notification manager |
| Messenger permission | [notifications/FacebookMessengerBotConsent.ts](../../platforms/web/facebook/src/notifications/FacebookMessengerBotConsent.ts), exposed through Settings actions; independent of manager consent |

## Provider and deployment prerequisites

| ID | Requirement and currently observed state |
| --- | --- |
| A0 | Current SDK v8 host support, callable methods, signed account/age gates and active adapter lifetime. The dashboard SDK selector is **8.0 [Network Enabled Zero Permissions]**. Production remains version **9**, bundle **29168977262783270**; Testing is version **15**, bundle **30470981679157112**, containing the earlier corrections and the enabled dedicated banner placement. Debug Mode is enabled. The permission-specific Zero Permission Access query reports `standard_access: true`, `advanced_access: false`, tier `BASIC`: BASIC developer-role access is granted; advanced public access is absent. The aggregate privilege still reports `is_live: false`, `is_rejected: true`, `grant_status: REJECTED`, and `access_level: none`. Role-account testing on desktop and physical Android does not establish public availability or product approval. |
| A1 | Product review: Business Verification **Verified**, In App Ads **Approved**. Approved Partner Program, Policy, Quality, In App Purchases, Bot and App Property each **Not Submitted**. Policy/Quality submission controls are disabled. General App Review says UNSUBMITTED while requirements claim a previous review is in progress. The follow-up history returns `submissions: []` and `has_been_previously_reviewed: false`, while the permission-specific query says `in_current_submission: true`. Preserve and reconcile these conflicting responses without inferring a pending or approved review. |
| A2 | Seven catalog products exist. A valid payout account, IAP approval, V2 payment callback/signed-event acceptance and consistent deployed checkout configuration remain outstanding. Recorded deployed commerce is disabled; webhook-ready configuration is absent. No purchase/refund acceptance is claimed. |
| A3 | Existing rewarded/interstitial IDs are configured. Version 15 completed a real nonsubscriber rewarded continuation and displayed one interstitial on the held third unique Classic win; dismissal restored the result with no extra ad reward. Version 12/13 observations retain their historical scopes. The dedicated menu space `1831460568074149` and Banner placement `1748953042991569_1831460981407441` now exist under property `957348766757902`; Ready to publish was observed before and after the version 15 check. The accepted artifact enables the banner flag and exact ID. Its desktop Settings visit showed no banner layout, recovery element or native banner, and a later IGDebug check confirmed `loadBannerAdAsync` is not advertised, while `hideBannerAdAsync` is. The physical Android session likewise omitted banner load and showed no Settings banner. No banner request was forced. Native J10 acceptance, banner provider readiness, live subscriber/durable-removal acceptance and remaining ad failure, cadence and host variants remain open. Respect authoritative subscription/ad-free eligibility and the banner service deadline. |
| A4 | Messenger Game Bot requires `pages_messaging` App Review and the `gamebot with Messenger` use case per the dashboard information panel. Bot Review is Not Submitted. SDK bot consent must remain distinct from existing `a2u-v1` manager consent. NEZP stored-content delivery requires a manager-authored plan, current-context recipient restriction, a dispatch consumer and trusted verification of returned content/app/recipient binding. A browser-supplied content ID alone cannot authorize campaign content. No documented Meta verification mechanism or manager approval workflow is established. |
| A5 | Cross-Play Management is **Not Linked**. An actual same-game/same-business app association and truthful attestation are required; legacy ASID eligibility is a separate condition. No approved account-migration/linking path is established. |
| A6 | No configured eligible second game destination or meaningful cross-promotion surface is established. Do not fabricate an app ID or count dormant `switchGameAsync` declarations as integration. |
| A7 | Private tournaments require app allowlisting, player rollout, eligible Messenger group and compatible dashboard higher-is-better scoring settings. Conditional creation/recovery is wired to verified race receipts; `VITE_FACEBOOK_PRIVATE_TOURNAMENTS_ENABLED` defaults off because these prerequisites remain unverified. |
| A8 | Game Details shows a linked Riddle Quest App Page. Group association and per-player eligibility remain unverified; generic community failures must not be reported as success. |
| A9 | Rooms requires a real current Messenger Rooms live match on a supported host. Discovery/join code exists; no actual eligible Room host or accepted join is evidenced. |

## All 79 documented SDK entry points

All rows also inherit A0 and the final artifact/review gates below. Journey references point to reproducible acceptance work, not completed results.

### Startup

| # | SDK entry point | Current source inclusion / evidence | Additional prerequisite | Reviewer journey |
| --- | --- | --- | --- | --- |
| 01 | `FBInstant.initializeAsync` | W · Bootstrap | A0; load v8 before bootstrap | J01 |
| 02 | `FBInstant.setLoadingProgress` | W · Bootstrap | A0; initialized host | J01 |
| 03 | `FBInstant.startGameAsync` | W · Bootstrap | A0; loading complete | J01 |
| 04 | `FBInstant.getSupportedAPIs` | W · Bootstrap and all optional adapters | A0; actual host capability list | J01, J14 |

### Environment and entry

| # | SDK entry point | Current source inclusion / evidence | Additional prerequisite | Reviewer journey |
| --- | --- | --- | --- | --- |
| 05 | `FBInstant.getLocale` | W · Bootstrap | A0; valid locale fallback | J01 |
| 06 | `FBInstant.getPlatform` | W · Host environment | A0; advertised getter | J02 |
| 07 | `FBInstant.getSDKVersion` | W · Host environment | A0; advertised getter | J02 |
| 08 | `FBInstant.getEntryPointData` | W · Bootstrap, referral/race entry codecs | A0; signed-in account; strict entry validation | J03, J06, J07 |
| 09 | `FBInstant.getEntryPointAsync` | W · Host environment | A0; startGameAsync already settled | J02 |

### Lifecycle and desktop

| # | SDK entry point | Current source inclusion / evidence | Additional prerequisite | Reviewer journey |
| --- | --- | --- | --- | --- |
| 10 | `FBInstant.quit` | W/H12/H14/H15 · Native exit to Games; v15 relaunch restored Reduced motion and, after three Classic wins, kettle puzzle/1,035 coins without another reward | A0; all accepted saves flushed | J04 |
| 11 | `FBInstant.onPause` | W · Lifecycle | A0; registered lifecycle adapter | J02, J09, J10 |
| 12 | `FBInstant.onResume` | W · Lifecycle, optional host signal | A0; browser fallback where absent | J02, J09, J10 |
| 13 | `FBInstant.onContextChange` | W · Contexts/coordinator | A0; active account and locale owner | J06, J07 |
| 14 | `FBInstant.getDisplayMode` | W/H12/H15 · Host environment; native Collapse/Expand mapped to normal/expanded DOM state, getter not traced independently | A0; eligible desktop host | J02 |
| 15 | `FBInstant.onDisplayModeChange` | W/H12/H15 · Host environment; native mode changes reached the game, callback not traced independently | A0; eligible desktop host | J02 |

### Invitations and updates

| # | SDK entry point | Current source inclusion / evidence | Additional prerequisite | Reviewer journey |
| --- | --- | --- | --- | --- |
| 16 | `FBInstant.inviteAsync` | W/H12/H15 · Profile Invite opened native Riddle Quest recipient surface; cancellation restored controls without selecting anyone or sending | A0; sharing rollout and audience gates | J03 |
| 17 | `FBInstant.shareAsync` | W/H12/H15 · Result Share opened native Riddle Quest composer; cancellation restored Share/Next Level, no audience choice or send | A0; sharing rollout; valid image/data | J03 |
| 18 | `FBInstant.updateAsync` | W · Context challenges | A0; configured race_context_challenge template; selected context | J06 |

### Scores and session data

| # | SDK entry point | Current source inclusion / evidence | Additional prerequisite | Reviewer journey |
| --- | --- | --- | --- | --- |
| 19 | `FBInstant.postSessionScore` | W · Session score; fallback when asynchronous variant is absent | A0; validated completed race receipt; general session or compatible private points tournament | J08 |
| 20 | `FBInstant.postSessionScoreAsync` | W · Session score; preferred variant | A0; validated completed race receipt; native UI eligibility | J08 |
| 21 | `FBInstant.setSessionData` | W · Host environment | A0; bounded non-identifying activity values | J02 |
| 22 | `FBInstant.logEvent` | W · Analytics | A0; analytics capability/consent and account lifetime | J02 |

### Engagement and external destinations

| # | SDK entry point | Current source inclusion / evidence | Additional prerequisite | Reviewer journey |
| --- | --- | --- | --- | --- |
| 23 | `FBInstant.canCreateShortcutAsync` | W/H12 · Settings actions; eligible shortcut action shown | A0; eligible home-screen host/player | J04 |
| 24 | `FBInstant.createShortcutAsync` | W/H12 · Settings actions; native prompt cancelled and action retired for session | A0; positive eligibility; one attempt per SDK session | J04 |
| 25 | `FBInstant.openExternalLinkAsync` | W/H12/H14/H15 · Fixed privacy and terms confirmations identified Riddle Quest and published destinations; Go back restored controls | A0; fixed privacy/terms HTTPS destinations | J04 |
| 26 | `FBInstant.performHapticFeedbackAsync` | W · Haptics | A0; saved opt-in; supported device; no reduced-motion/pause suppression | J05 |
| 27 | `FBInstant.switchGameAsync` | G · No cross-game adapter/destination | A6; real eligible game owned/configured by this business | J13; future explicit cross-promotion journey |

### Advertising

| # | SDK entry point | Current source inclusion / evidence | Additional prerequisite | Reviewer journey |
| --- | --- | --- | --- | --- |
| 28 | `FBInstant.getInterstitialAdAsync` | W/H12/H15 · Real v15 interstitial on held third unique Classic win; dismissal restored result/Next Level/Share with ordinary reward only | A0, A3; configured approved interstitial placement; authoritative eligibility | J09 |
| 29 | `FBInstant.getRewardedVideoAsync` | W/H12/H13/H15 · Real v15 nonsubscriber video completed; seven editable cells restored and 920 coins unchanged; fresh eligibility inferred through reviewed gates | A0, A3; configured rewarded placement; eligible server session | J09 |
| 30 | `FBInstant.loadBannerAdAsync` | C · Banner, entry and reserved layout | A0, A3; explicit true flag and separate approved banner placement; before 31 March 2027 | J10 |
| 31 | `FBInstant.hideBannerAdAsync` | C · Banner and dialog guard | A0, A3; paired callable support; serialized native ownership | J10 |

### Matchmaking and current tournament

| # | SDK entry point | Current source inclusion / evidence | Additional prerequisite | Reviewer journey |
| --- | --- | --- | --- | --- |
| 32 | `FBInstant.checkCanPlayerMatchAsync` | W · Native matchmaking | A0; matchmaking rollout; eligible audience/context | J06 |
| 33 | `FBInstant.matchPlayerAsync` | W · Native matchmaking/context coordinator | A0; positive matching eligibility; locale-safe queue | J06 |
| 34 | `FBInstant.getTournamentAsync` | W · Tournament presentation, entry and session-score guard | A0; native tournament launch/context | J07, J08 |

### Player identity

| # | SDK entry point | Current source inclusion / evidence | Additional prerequisite | Reviewer journey |
| --- | --- | --- | --- | --- |
| 35 | `FBInstant.player.getID` | W · Credential exchange and bootstrap | A0; app-scoped identity; verified server exchange | J01 |
| 36 | `FBInstant.player.getASIDAsync` | G · No migration/linking caller | A5; eligible legacy/migrated user; actual account-link use | J13 |
| 37 | `FBInstant.player.getSignedASIDAsync` | G · No migration/linking authority | A5; eligible legacy identity and signature verification | J13 |
| 38 | `FBInstant.player.getAssociatedAppsASIDAsync` | G · No cross-play association/caller | A5; real same-game association; dashboard currently Not Linked | J13 |
| 39 | `FBInstant.player.getSignedAssociatedAppsASIDAsync` | G · No cross-play linking authority | A5; real association and server-verifiable account linking | J13 |
| 40 | `FBInstant.player.getSignedPlayerInfoAsync` | W · Nonce-bound credential exchange | A0; server nonce and signature verification | J01, J14 |
| 41 | `FBInstant.player.getAgeCategoryAsync` | W · Capability policy | A0; authoritative age-dependent capability gating | J01, J14 |

### Player save

| # | SDK entry point | Current source inclusion / evidence | Additional prerequisite | Reviewer journey |
| --- | --- | --- | --- | --- |
| 42 | `FBInstant.player.getDataAsync` | W · Bootstrap and account-owned persistence | A0; signed-in current account | J01, J04 |
| 43 | `FBInstant.player.setDataAsync` | W · Account-owned persistence | A0; serialized accepted saves/preferences; no economic authority | J01, J04, J05 |
| 44 | `FBInstant.player.flushDataAsync` | W · Persistence, lifecycle and quit | A0; accepted writes before quit/deletion cleanup | J01, J04, J14 |

### Player connections

| # | SDK entry point | Current source inclusion / evidence | Additional prerequisite | Reviewer journey |
| --- | --- | --- | --- | --- |
| 45 | `FBInstant.player.getConnectedPlayersAsync` | W/H12/H15 · Native social displayed Friends who play 0; no nonempty result or player match established | A0; native-social/age/context policy; recently active connections | J06 |

### Player bot and NEZP notifications

| # | SDK entry point | Current source inclusion / evidence | Additional prerequisite | Reviewer journey |
| --- | --- | --- | --- | --- |
| 46 | `FBInstant.player.canSubscribeBotAsync` | C · Messenger permission; checked before each explicit prompt | A4; notification provider present and Messenger deployment flag enabled | J12 |
| 47 | `FBInstant.player.isSubscribedBotAsync` | C · Messenger permission; restore and admitted-attempt reconciliation | A4; native status never substitutes for manager A2U consent | J12 |
| 48 | `FBInstant.player.subscribeBotAsync` | C · Separate Messenger game updates Settings action | A4; explicit player request, approved bot and positive current eligibility | J12 |
| 49 | `FBInstant.player.createNEZPNotificationContentAsync` | G · No manager-owned content-ID bridge | A4; manager content/scheduling ownership and accepted content contract | J12, J13 |

### Contexts

| # | SDK entry point | Current source inclusion / evidence | Additional prerequisite | Reviewer journey |
| --- | --- | --- | --- | --- |
| 50 | `FBInstant.context.getID` | W · Contexts, native social and race entry | A0; strict server-bound context identifier | J06, J07 |
| 51 | `FBInstant.context.getType` | W · Contexts; includes POST | A0; supported context type and synchronized owner | J06 |
| 52 | `FBInstant.context.chooseAsync` | W/H12/H15 · Play with friends opened native chooser; cancellation restored Play with friends/Start PvP, no selection or context message | A0; native social policy and dialog guard | J06 |
| 53 | `FBInstant.context.switchAsync` | W · Native social: solo or actual current Room | A0; valid destination; authoritative reconciliation | J06, J07 |
| 54 | `FBInstant.context.createAsync` | W/H12/H15 · Choose friends showed Service temporarily unavailable and retired through Refresh; failure path only, raw SDK error code not captured | A0; Meta picker and account/context policy | J06 |
| 55 | `FBInstant.context.getPlayersAsync` | W · Native social aggregate count | A0; selected context; recent membership, not live presence | J06 |

### Payments

| # | SDK entry point | Current source inclusion / evidence | Additional prerequisite | Reviewer journey |
| --- | --- | --- | --- | --- |
| 56 | `FBInstant.payments.onReady` | C · Commerce session | A0, A2; authenticated commerce rollout | J11 |
| 57 | `FBInstant.payments.getCatalogAsync` | C · Commerce capability | A0, A2; seven configured products and supported payment host | J11 |
| 58 | `FBInstant.payments.purchaseAsync` | C · Commerce capability, signed server grant | A0, A2; payout, IAP approval and signed V2 webhook readiness | J11 |
| 59 | `FBInstant.payments.getPurchasesAsync` | C · Purchase recovery | A0, A2; authenticated account and authoritative reconciliation | J11 |
| 60 | `FBInstant.payments.consumePurchaseAsync` | C · Purchase recovery after server grant | A0, A2; only verified consumables; durable never consumed | J11 |

### Tournaments

| # | SDK entry point | Current source inclusion / evidence | Additional prerequisite | Reviewer journey |
| --- | --- | --- | --- | --- |
| 61 | `FBInstant.tournament.createAsync` | W · Tournament presentation | A0; official daily window/locale/score receipt | J07 |
| 62 | `FBInstant.tournament.createPrivateAsync` | C · Session-score group action with explicit chat disclosure and uncertain-outcome recovery | A7; positive deployment flag, eligible group and verified race receipt | J08, J13 |
| 63 | `FBInstant.tournament.getTournamentsAsync` | W/H12/H15 · Native social displayed an empty tournament list; no populated listing or join established | A0; eligible active native tournaments; validated metadata | J07 |
| 64 | `FBInstant.tournament.joinAsync` | W · Native social join | A0; unexpired listed tournament; Meta participant eligibility | J07 |
| 65 | `FBInstant.tournament.postScoreAsync` | W · Tournament presentation | A0; server-derived adjusted time and daily binding | J07 |
| 66 | `FBInstant.tournament.shareAsync` | W · Tournament presentation | A0; native tournament exists; explicit player action | J07 |

### Community

| # | SDK entry point | Current source inclusion / evidence | Additional prerequisite | Reviewer journey |
| --- | --- | --- | --- | --- |
| 67 | `FBInstant.community.canFollowOfficialPageAsync` | W · Settings actions | A0, A8; linked official page and host eligibility | J04 |
| 68 | `FBInstant.community.canJoinOfficialGroupAsync` | W · Settings actions | A0, A8; linked official group and host eligibility | J04 |
| 69 | `FBInstant.community.followOfficialPageAsync` | W · Settings actions | A0, A8; positive current eligibility | J04 |
| 70 | `FBInstant.community.joinOfficialGroupAsync` | W · Settings actions | A0, A8; positive current eligibility | J04 |

### Messenger Rooms

| # | SDK entry point | Current source inclusion / evidence | Additional prerequisite | Reviewer journey |
| --- | --- | --- | --- | --- |
| 71 | `FBInstant.room.getCurrentMatchAsync` | W · Native social current-Room discovery | A0, A9; actual Messenger Rooms match; not an arbitrary race lobby | J06 |

### Overlay factories

| # | SDK entry point | Current source inclusion / evidence | Additional prerequisite | Reviewer journey |
| --- | --- | --- | --- | --- |
| 72 | `FBInstant.overlayViews.createOverlayViewAsync` | W · Generic profile fallback from canonical bundled XML | A0; selected when convenience pair unavailable | J01, J14 |
| 73 | `FBInstant.overlayViews.createOverlayViewWithXMLStringAsync` | W · Same profile XML, inline async alternative | A0; selected when earlier factories unavailable | J01, J14 |
| 74 | `FBInstant.overlayViews.createOverlayView` | W · Callback file alternative, frame attached before readiness | A0; selected when async factories unavailable | J01, J14 |
| 75 | `FBInstant.overlayViews.createOverlayViewWithXMLString` | W · Callback inline alternative with same lifecycle | A0; selected when earlier factories unavailable | J01, J14 |
| 76 | `FBInstant.overlayViews.createProfilePictureOverlayViewAsync` | W · Overlay capability | A0; Meta-owned identity rendering | J01, J14 |
| 77 | `FBInstant.overlayViews.createProfileNameOverlayViewAsync` | W · Overlay capability | A0; Meta-owned identity rendering | J01, J14 |

### Overlay management

| # | SDK entry point | Current source inclusion / evidence | Additional prerequisite | Reviewer journey |
| --- | --- | --- | --- | --- |
| 78 | `FBInstant.overlayViews.setCustomEventHandler` | W · Scoped generic-profile photo failure and name-only fallback | A0; advertised handler, owned view and fixed event | J01, J14 |
| 79 | `FBInstant.overlayViews.getOverlayViews` | W · Recovers only owned generic handles for teardown | A0; advertised inventory; never destroys unrelated surfaces | J01, J14 |

## Reviewer journeys for the exact candidate

Record the final source commit, archive SHA-256, Meta version/bundle, host/OS, account role, locale, advertised API list, date, observed outcome and sanitized evidence path for each journey. Record unsupported or ineligible hosts as such; they do not prove the supported path. Use separate consenting role-account testers for social actions. Do not send messages or cause purchases without the corresponding authorization. Tests or scripted browser harnesses require an explicit user request; this document does not supply that authorization.

### J01 — Startup, identity, save and profile

Launch the exact selected candidate using a role account. Verify loading progresses, startup finishes, expected locale/fallback applies and no separate game password is required. Confirm the server accepts nonce-bound identity and gives the expected account. Open Race to 10, then Activity or Tournaments, and inspect Meta-rendered name/photo overlays. Complete a Classic puzzle, change a preference, close/relaunch and confirm both persist without duplicate rewards. Repeat with another authorized account to establish save/profile separation. Missing or expired identity, rejected age lookup and failed save must not activate privileged features or erase accepted progress. Save raw signatures/player IDs only in the permitted private evidence store, never this document.

### J02 — Host environment, lifecycle, events and session metadata

The [version 15 physical Android check](evidence/facebook-android-host-version-15-2026-11-27.md) moved from the game to Home and back through Recents to the same Facebook task. The kettle puzzle and 1,035 coins survived, and answer entry/deletion worked after return. This establishes background/reentry and input recovery, not independent SDK callback execution or the audio/save/native-dialog variants below.

Inspect bounded platform/SDK/entry-source diagnostic fields after startup; compare them with the real host. The session metadata contains only the game identifier and online/playing/racing activity. Observe a native desktop display-mode change and confirm layouts/profile overlays remeasure; it is not a fullscreen-toggle control. Background/resume during gameplay, audio, saves and native dialogs, and verify only the current account/lifetime resumes. Verify optional getters/rejected entry reads do not prevent play. Where the display getter initially lacks support, establish later mode observation from the actual host rather than assuming a static startup capability list is exhaustive. Check sanitized event payloads and consent behavior without exposing answers or identity.

### J03 — Invitations, result shares and entry acceptance

Use the general Invite action, a completed-result Share action and a live-race invitation with consenting testers. Verify native dialogs use the expected card and bounded opaque data. Close each dialog without sending, then complete a separately authorized send. A resolved invite promise alone is not delivery evidence and must not grant coins. Open the recipient link and confirm referral or challenge parsing, explicit acceptance where required, correct locale/session binding and no duplicate referral reward. Exercise unsupported invite with supported share fallback, rejected images, stale account ownership and delayed dialog completion.

### J04 — Settings native actions and fixed legal links

The version 15 Android Privacy Policy action opened **Open link in Facebook browser?**; **CANCEL** restored Settings. No shortcut action appeared despite advertised shortcut methods, so mobile shortcut eligibility and cancellation remain unverified. No preferences or opt-ins were changed.

Open Settings. On eligible hosts verify **Add to home screen**, **Follow our page**, **Join our group**, **Privacy Policy**, **Terms of Use** and **Quit game**. Validate each eligibility-dependent action independently. Decline the shortcut prompt and ensure it is not requested again in that SDK session. Cancel follow/join and external-link prompts without success messaging; unavailable/unlinked page/group controls must disappear or report unavailable. Legal links must resolve to the fixed published Riddle Quest pages, never entry-provided destinations. Quit only after accepted saves finish; a failed flush must keep the game open with a recoverable notice. Observe cleanup of overlays, banners, presence and retired account operations.

### J05 — Opt-in haptics

The inspected version 15 Android session did not advertise `performHapticFeedbackAsync`; no opt-in or feedback request was made. This does not establish the supported-device path.

On a supported device open Settings → **Vibration**. Verify it starts Off for a fresh account and persists independently per account. Turn it On, complete a correct Classic/Daily result and observe one native feedback request for that result. Reopening a result must not vibrate again. An incorrect result, hidden/paused host, reduced-motion preference, retired account or disabled vibration must suppress feedback. An unsupported/rejecting native method must not block rewards or gameplay; `CLIENT_UNSUPPORTED_OPERATION` retires the action.

### J06 — Facebook social lobby, contexts, matchmaking and Rooms

Open Race to 10's lobby and expand **Play on Facebook**. Verify **Friends who play** and **Players in this group** are aggregate recent-player counts, not identity directories or online-presence claims. Select **Choose friends**, cancel once, then use consenting testers to create a context. Confirm the resulting native context is reconciled before race membership/challenges use it. Exercise the existing context chooser/native matchmaking separately, preserving locale boundaries and server authority. Send the explicit selected-context challenge and verify the `race_context_challenge` template and `NO_PUSH` behavior without another reward. Use **Return to solo play** and confirm old context data is retired.

For Rooms, the **Join room game** action appears only when a real current live match has a distinct valid context. Observe a supported join and its authoritative reconciliation. No Room or `LIVE_MATCH_NOT_FOUND` is an empty/ineligible result, not a successful integration. Close the panel while reads or native dialogs are pending; no late prompt may open after an unadmitted action, and an already admitted operation must reconcile its actual native context. Check errors, empty lists, malformed metadata, refresh and account/locale/context changes.

### J07 — Native tournament discovery, joining and official scores

In **Play on Facebook**, inspect **Facebook tournaments**, refresh and choose **Join tournament** for an eligible listed tournament. Validate empty, expired, malformed and unsupported listings. The list supplies native navigation only; it must not grant coins or establish official game membership. After joining, verify native context reconciliation and strict interpretation of native tournament payload before entering the game's official tournament surface. Cancellation/eligibility rejection must recover without stale membership.

Separately complete an official daily race, verify the server's locale/day/run binding and adjusted-time result, then exercise the existing native tournament create/share/score path. Confirm lower-is-better adjusted-time presentation and exact daily window; native standings cannot change the authoritative economy. Exercise tournament entry through an authorized shared link. Conditional private tournament creation has its separate prerequisite-dependent journey in J13; public creation is not evidence for `createPrivateAsync`.

### J08 — Explicit native session score

Complete an official server-validated race and return to the Facebook race lobby. Inspect the explicit session-score action only after the matching receipt is accepted. Verify score derivation from the authoritative five-minute ceiling minus adjusted milliseconds; never use coins, lifetime level or untrusted client timing. Prefer the asynchronous API where supported and use the synchronous variant only as its alternative, not a duplicate submission. Do not post inside a native tournament where semantics could conflict. Confirm one attempted publication per receipt and only a better eligible score within the session. Observe cancellation/rejection and any resulting native context change, navigation before SDK admission, stale locale/account retirement and races whose day has expired. Retain evidence for both API variants only on hosts that actually advertise them.

### J09 — Rewarded video and interstitials

In a permitted Classic/Daily loss state choose **Watch a video for an extra try**. Verify completion grants one server-authoritative extra attempt without coins, while early cancellation/no-fill grants nothing. Simulate no transport loss unless authorized; where an actual retry is observed, it must reuse the earned continuation request rather than require another ad or grant again. Verify current result/session ownership throughout.

Complete unique Classic/Daily levels to reach the three-level interstitial opportunity, respecting cooldown and session caps; repeated result presentation and racing must not increment it. Check accepted subscription suppression for both formats and durable ad removal for interstitials. Backgrounding, leaving the result or changing entitlement while loading must suppress stale display.

The [version 15 native check](evidence/facebook-native-social-ads-version-15-2026-11-27.md) completed a real rewarded video and returned seven editable cells with 920 coins unchanged. Three unique Classic wins then earned ordinary rewards of 35, 25 and 55 coins. Holding the third result displayed a real interstitial; dismissal restored the result with 1,035 coins, enabled Next Level/Share and no extra ad reward. Native quit/relaunch restored the following kettle puzzle and balance without another reward. These H15 nonsubscriber outcomes establish one continuation and one three-win interstitial opportunity, not every cooldown, cap or failure path. H9/H12/H13 observations retain their original candidate scopes.

The client gate combines fresh configuration with the authenticated account's server-owned subscription field, fails closed when unknown, and permits retry without admitting a native ad. Successful eligibility in H15 is inferred from the reviewed gates and native outcome; the direct nested-frame entitlement request trace was not captured. Controlled tests passed for subscribers and subscription changes during loading. Native subscriber suppression, durable removal, early cancellation, no-fill, transport loss, duplicate-continuation recovery, background/resume and remaining cadence/host variants still require their own acceptance. The attempted background check left the document visible, so it did not establish a background/resume transition.

### J10 — Optional banner format

Version 15 contains the enabled dedicated banner placement, whose status remained Ready to publish before and after its desktop check. That check showed no banner layout, recovery element or native banner. The follow-up rendered SDK Info advertised `hideBannerAdAsync` but omitted `loadBannerAdAsync`, directly failing the existing admission guard. The physical Android session independently omitted banner load and showed no Settings banner. No request/result was forced or captured; no-fill, impression and hiding remain unverified. Client activation and H15 graceful fallback do not complete this journey. On a supported eligible host, visit a static Settings or Profile surface and verify reserved bottom space keeps content and controls reachable. Enter gameplay/racing, pause, hide the page or open another native dialog and confirm the banner hides before interaction proceeds. Check no-fill, late load completion, entitlement refresh, hide rejection, retry, account replacement, quit and deletion. A failed hide must retain safe layout/interaction handling; it must not silently release another native dialog over the ad. Confirm subscriber/ad-free eligibility combines fresh configuration with the verified account's server-owned subscription read; unknown authorization must hide the banner and allow only a later eligible-visit retry. Ensure the service deadline disables new loads; the documented phase-out ends 31 March 2027.

### J11 — Payments and recovery

Blocked until A2 is satisfied. Open the Shop with an approved test-payment account and verify native catalog IDs/prices match all six coin packs plus the durable **Remove Interstitial Ads** product. Exercise native cancel, a signed successful test purchase, asynchronous V2 webhook arrival, lost client acknowledgement, replay/relaunch recovery and an authorized refund. Require the server grant before consumable consumption and never consume the durable. Confirm no duplicate grants, correct debt/entitlement reversal and ad eligibility refresh. An empty or unsigned rewarded-video-fallback receipt must not enter the signed purchase grant path. This is a separate pilot gap, not a successful one-time checkout.

### J12 — Notification preference and separate Messenger permission

Settings → **Notifications** exercises the current account registration/explicit Facebook consent path and manager handoff. With an authorized delivery test, the notification manager owns content, scheduling and sending; device/host receivers own display and response. Once A4 is approved and the conditional Messenger action enabled, verify **Messenger game updates** only probes on restore, prompts after an explicit request and positive eligibility, and reconciles an admitted result after cancellation/rejection. Confirm this does not alter the master notification preference or send anything. The [consent evidence](evidence/facebook-messenger-consent-2026-11-27.md) distinguishes the three implemented permission methods from the remaining NEZP content bridge. No real subscription, content creation or send is authorized merely by this checklist.

### J13 — Unmatched APIs and prerequisite-dependent gaps

The remaining source/workflow gaps are four legacy/associated-app identity methods, `switchGameAsync`, and `createNEZPNotificationContentAsync`. Private tournaments, Messenger permission and generic overlays now have reachable conditional/fallback implementations; their provider prerequisites and final-candidate acceptance are still open. Do not relabel an absence as host incompatibility without an authoritative app/host check.

For unresolved workflows, establish the real product destination, current provider contract and prerequisites before implementation. Generic overlay variants select one supported profile path; verify each fallback, scoped photo-error recovery and cleanup without extracting names/photos. For private tournaments after A7 approval, complete a verified race, use the explicit group action with consenting testers, verify the disclosed chat post, and inspect recovery from an uncertain response without blind duplicate creation. Cross-play and private setup must not invent an associated app, attestation, allowed score or grant.

### J14 — Cross-cutting unavailable, cancellation and retirement matrix

For every optional family record behavior when its name is absent from `getSupportedAPIs`, the advertised function is missing, provider eligibility is false, the SDK rejects, or the account/locale is retired during an asynchronous operation. Verify the game remains usable with no false success, reward or stale native surface. Check serialized dialogs against ads and overlay teardown; a timeout of observation is not proof a still-running provider dialog ended. Validate non-Facebook artifacts remain free of FBInstant/ad/native dependencies after shared contracts or views change. Source inspection is provisional; record supported native web and representative mobile evidence for the final candidate.

## Returned-object coverage and remaining gaps

The 79-row count covers SDK entry points, not methods on returned objects. Verify their owning flows separately:

| Object | Needed evidence |
| --- | --- |
| AdInstance | `getPlacementID` must exactly match the configured placement before loading and again before showing. Invalid/missing/throwing getters fail closed; current-owner and entitlement checks follow both reads. Version 15 desktop completed a real nonsubscriber rewarded continuation and displayed/dismissed one interstitial after three unique Classic wins. Individual getter/entitlement calls were not independently traced; gate success is inferred from reviewed source and the native outcome. Live subscriber/durable-removal behavior, direct entitlement tracing and remaining failure, cadence and host variants still need acceptance. H12/H13 retain their historical scopes. |
| SignedPlayerInfo | Server-verified player ID/signature bound to the issued nonce. |
| SignedASID / SignedAssociatedAppASID | Still part of the missing migration/association authority; no identity merge based only on a browser-returned ID. |
| ConnectedPlayer / ContextPlayer | Validated IDs stay within the Facebook boundary; UI exposes counts, not extracted names/photos. |
| Tournament | ID/end-time/title/context/payload use validated for its flow. All six declared getters have meaningful reachable consumers in the [source audit](evidence/facebook-returned-object-coverage-2026-11-27.md); populated native discovery/join and private-tournament acceptance remain open. |
| LiveMatch | Both declared getters validate match/context IDs during discovery and are reread before a switch, as confirmed in the [source audit](evidence/facebook-returned-object-coverage-2026-11-27.md). Room lookup alone is not hosted co-play acceptance. |
| OverlayView | Profile views use show, direct destroy (dismissal fallback), owned IDs/iframes and stale-owner cleanup. Generic photo events replace the failed view once. No profile content is read back. Current optional `getStatus`, `getInitialData`, `getErrors` and `updateAsync` remain undeclared and unused. The [returned-object audit](evidence/facebook-returned-object-coverage-2026-11-27.md) records their contracts and why the current fixed profile templates do not need them; these methods are not counted as integrated. |

## APIs outside the viable current v8 scope

The research inventory establishes that raw player name/photo access was removed for Zero Permissions, native global leaderboards are deprecated/rejecting, old statistics wrappers and rewarded-interstitial JavaScript APIs are absent, and recurring Instant Games subscriptions are unsupported. A favorites/bookmark method was not found in the complete current inventory. These are documented unavailable APIs, not missing integrations to simulate. Recheck official contracts before changing these dispositions. Banners remain an explicitly temporary supported integration during phase-out, not permanent coverage.

The rewarded-video IAP fallback pilot is also not completed: it requires separate approval/product configuration and returns an unsigned fallback result with different grant semantics. Existing normal purchase authority must continue rejecting that shape until a separate authoritative protocol is designed and accepted.

## Exact artifact and release completion gates

- [ ] Resolve every G entry with a real reachable integration or current app/host/contract evidence establishing why it cannot be enabled. Preserve missing prerequisites explicitly; they are not completion evidence.
- [x] Reinspect the client source after concurrent integration work. Earlier reviews addressed Settings ownership, tournament routing, native-display ownership and the version 13 subscription read. Version 14's independent review found no blocker in bounded Settings preparation or captured-account checkout admission; purchase recovery and native-dialog ownership remain unchanged. Exact-host acceptance remains scoped below.
- [x] Complete the Facebook client build and static/archive checks. Canonical `pnpm preflight:facebook-upload` passed for version 15. Banner/configuration verification passed 20 tests across two suites in 0.257 seconds; the full real-entry browser journey passed in 33.923 seconds with external banner fixtures. The artifact audit covered 420 runtime files, 4.51 MB total and 0.71 MB initial resources, with no Jest gaming SDK, native-module or secret leakage. The accepted archive contains the true banner flag and exact placement ID; Qwordly scan matches were zero. Earlier 122-test subscription and 39-test Settings results retain their version 13/14 scopes. Firebase packaging/deployment was not changed or rerun under the owner freeze; deployed backend verification remains open separately.
- [x] Prepare a clean immutable client archive from the agreed release source; record commit, SHA-256, byte count and contents. Version 15 is bound to clean `66de0e9da202b5889da5bbf1dd54a98b03bb6bc0`, SHA-256 `5803b051ff965b97b7ea1e8669d816172983a7c7a1ae8ab8a44ba9a630cbf824`, 2,865,675 bytes, 422 ZIP entries and 420 runtime files. Backend deployment verification remains a separate open gate; its source/configuration is preserved by owner instruction.
- [x] The owner explicitly authorized Facebook test uploads from this checkout on 27 November. The upload CLI now accepts `main` or `facebook`, retaining clean-source, exact-archive and unresolved-handoff gates; other branches are rejected.
- [x] Authorization covers the Facebook uploads needed for testing. Production promotion, review submission and publication remain separate actions requiring their own authorization.
- [x] Confirm the authorized upload finished processing and its exact archive identity, Testing assignment and SDK selector. Version 15 was uploaded once, finished processing and was explicitly assigned to Testing on SDK 8.0 NEZP; the independently downloaded archive matches the recorded SHA-256 and byte count, and the local acceptance receipt is recorded. Production remains version 9. This gate does not establish feature-specific eligibility.
- [ ] Verify the deployed backend revision and feature flags for every server-owned integration; the client archive alone cannot establish receipt, identity, context, tournament, ad-entitlement or notification authority. [Selected metadata is verified for 32 functions](evidence/facebook-deployed-authority-2026-11-27.md), without runtime invocation. The [source comparison](evidence/facebook-deployed-source-comparison-2026-11-27.md) contradicts exact equality with the protected baseline for all three downloaded representatives and identifies missing subscription-based ad suppression in the active configuration source. Version 13 compensates with a client-owned read of the existing server-owned subscription field; local subscriber tests and the hosted nonsubscriber rewarded path passed, without backend repair. Original source-commit correspondence, remaining shared endpoints, live subscriber behavior and other runtime authority still require acceptance; the Firebase freeze remains in force.
- [ ] Finish/reconcile all applicable approvals: Approved Partner Program, Zero Permission Access beyond the granted BASIC role-account scope, Policy, Quality, IAP/payout/payment callbacks, Bot if added, App Property if required, and format-specific ads eligibility. Business Verified and In App Ads Approved cover only those named gates.
- [ ] Complete the relevant J01–J14 journeys on the final hosted candidate, with supported web/mobile hosts, authorized accounts and exact evidence references. Version 15 has narrow H15 startup/inactive-banner evidence, [native legal cancellation, preference save/restore and display-mode checks](evidence/facebook-native-settings-version-15-2026-11-27.md), and [social cancellation/discovery, rewarded continuation, one three-win interstitial and Classic progress persistence](evidence/facebook-native-social-ads-version-15-2026-11-27.md). A transient relaunch service error recovered without reload; its cause remains unproven. Other historical H12/H13/H14 journeys are not current-candidate acceptance. The [physical Android check](evidence/facebook-android-host-version-15-2026-11-27.md) adds exact-bundle startup, saved puzzle/balance, Privacy Policy cancellation and Home/Recents input recovery. Social delivery/joins, subscriber suppression, remaining ad failure/cadence variants, other mobile journeys and supported-host J10 acceptance remain open. No production/review success may be inferred from an SDK declaration, locally passing build or earlier hosted observation.
- [ ] Verify official page/group associations, genuine cross-play configuration, private-tournament allowlisting, eligible Rooms hosting and the separate banner placement where those integrations are included.
- [ ] Refresh the final reviewer instructions and feature claims to match actual enabled behavior, legal/age disclosures and support/retention operations. Complete owner-required final publication approval before public release.

This checklist deliberately retains outstanding work. It is not a release sign-off and does not declare the active goal complete.
