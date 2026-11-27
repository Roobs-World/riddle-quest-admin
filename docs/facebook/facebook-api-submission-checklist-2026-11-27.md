# Facebook API submission checklist — 27 November 2026

**Status: version 14 is in Testing; submission completeness is unproven.** This checklist covers every one of the 79 public SDK entry points in the [current primary-source inventory](facebook-api-research-2026-11-27.md). The uploaded source is `61fc18b0a3df0d6efd69b2b28eb1eeb3abb8e24f` on the owner-requested `facebook` branch. Exact archive identity and narrow desktop observations are recorded below; they do not establish approval or acceptance of every integration. Later source changes require their own artifact and host checks.

The scope remains every possible applicable API integration. An absent adapter, missing configuration, missing product surface or missing partner approval is an open item, not a completed integration. Alternative APIs are tracked individually even when one real workflow deliberately selects only one of them. Removed or deprecated unavailable APIs are distinguished at the end.

## Authoritative evidence and status

- [Dashboard prerequisites](evidence/facebook-dashboard-api-prerequisites-2026-11-27.md): current product-specific hosting, review and cross-play observations.
- [Connector review JSON](evidence/facebook-live-review-state-2026-11-27.json): app-review status, requirements and individual privileges. There is no separate dashboard-prerequisites JSON.
- [Permission-specific role-access follow-up](evidence/facebook-role-access-followup-2026-11-27.json): Zero Permission Access reports BASIC standard access and no advanced access, while aggregate privilege and review-history fields remain inconsistent.
- [Selected deployed authority metadata](evidence/facebook-deployed-authority-2026-11-27.md): read-only metadata confirms revisions and selected non-secret configuration for 32 active functions. No function was invoked; full backend acceptance remains open.
- [Deployed source comparison](evidence/facebook-deployed-source-comparison-2026-11-27.md): three downloaded representatives differ from the protected baseline. The active configuration source lacks subscription-based ad suppression; version 13 adds an independent client read of the existing server-owned subscription field. No live subscriber harm was observed. Firebase remains preserved.
- [Subscription ad gate correction](evidence/facebook-subscription-ad-gate-2026-11-27.md): 122 focused tests across seven suites, the integrated injected-SDK browser journey in 30.907 seconds, security review and canonical upload preflight passed. Controlled subscriber fixtures are separate from native host acceptance.
- [Exact version 14 acceptance record](evidence/facebook-testing-version-14-2026-11-27.json): Testing bundle `30477676368485685`, SHA-256 `d44c2e9b59b9eea398d8bdd0382149898161a2726bad8ec2d8289a1bb0cae03d`, 2,865,660 bytes. Canonical preflight passed; uploaded once, processed and explicitly assigned to Testing. Independent provider download hash and bytes matched, and local acceptance was recorded. Production remains version 9.
- [Native version 14 Settings and quit/relaunch](evidence/facebook-native-settings-version-14-2026-11-27.md): slow initial startup restored the coconut puzzle and 920 coins; native Privacy Policy and Terms confirmations identified Riddle Quest and the fixed roobsworld.com destinations. Go back cancellations restored controls. Quit navigated to Gaming; relaunching the same candidate restored the same puzzle and balance with Settings and Multiplayer enabled. No native purchase, live account replacement, eligibility-timeout fixture or new rewarded-ad test was performed.
- [Historical version 13 acceptance record](evidence/facebook-testing-version-13-2026-11-27.json): accepted then-Testing bundle `29536858815945546`, SHA-256 `4f0f61b92bc08c9170bc6c4ec5dae0982cfc57e525511158b8969fba8e96c1cf`, 2,865,505 bytes. Its evidence retains that exact candidate scope.
- [Historical version 13 subscription-gated continuation](evidence/facebook-native-subscription-version-13-2026-11-27.md): slow startup restored the Classic coconut puzzle and 920 coins; a real rewarded video completed and returned seven editable cells without changing coins. Fresh entitlement acceptance for this nonsubscriber is inferred through the reviewed display gates; a direct nested-frame GET/status/header trace and live subscriber check were not obtained. This journey was not repeated on version 14.
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
- [Current reviewer handoff](facebook-review-draft-2026-11-27.md): exact version 14 steps, retained historical H12/H13 regression procedures, enabled behavior and remaining prerequisites; the September draft is historical.
- [Published disclosures check](evidence/facebook-published-disclosures-2026-11-27.md): the fixed privacy and terms pages loaded and identify Riddle Quest, its publisher/support route, Facebook audience restrictions and conditional features. This is a content check, not legal approval or proof of operational retention compliance.
- [Banner setup follow-up](evidence/facebook-banner-activation-2026-11-27.md): Meta offered the Banner format; a dedicated Riddle Quest Menus space and placement were created with observed status Ready to publish. Client Testing activation and exact-host acceptance are being verified; this label alone does not establish ad fill or review approval.
- [Returned-object source audit](evidence/facebook-returned-object-coverage-2026-11-27.md): all six Tournament getters and both LiveMatch getters have reachable consumers. Real eligible joins and private-tournament prerequisites remain separate.
- [Native action lifetime corrections](evidence/facebook-native-action-lifetimes-2026-11-27.md): version 14 includes bounded Settings eligibility preparation, which passed 39 focused tests across two suites, and captured account ownership, which passed the real built-entry browser regression in 33.233 seconds after a confirmed failing old-entry run. Exact-archive acceptance and the narrow H14 host check are recorded separately; native timeout, account-replacement and purchase acceptance remain unproven.
- [Earlier source coverage](evidence/facebook-api-coverage-2026-11-27.md): historical baseline, superseded by this checklist's broader scope for future work.

| Code | What the evidence establishes |
| --- | --- |
| W | Source implementation and its entry/UI wiring were inspected. Exact-artifact and supported-host evidence are tracked separately; this code alone is not acceptance. |
| C | Implementation is wired conditionally but provider/deployment prerequisites prevent claiming an active integration. |
| G | Integration gap: no reachable implementation or complete meaningful workflow was found. |
| H9 | Narrow historical hosted observation in version 9 only. Every changed flow still needs final-candidate acceptance. |
| H12 | Narrow historical hosted observation on exact version 12; it does not certify version 14 or other journeys. |
| H13 | Narrow historical startup and rewarded-continuation observation on exact version 13 for a nonsubscriber. It does not certify version 14; direct entitlement network tracing, live subscriber behavior and other journeys remain separate. |
| H14 | Narrow hosted startup, fixed legal-link cancellation and quit/relaunch observation on exact Testing version 14. Native purchases, account replacement, eligibility timeouts and rewarded ads were not exercised in this check. |

None of these codes means the final submission requirement is complete. The [combined candidate verification](evidence/facebook-expanded-api-final-verification-2026-11-27.md) covers the later private-tournament, Messenger-consent and generic-overlay additions. The owner explicitly authorized focused tests and browser verification on 27 November. All 398 focused tests and the expanded local injected-SDK browser journey passed. No fresh hosted acceptance is implied by source inspection or local checks. Version 13 introduced the separately recorded 122-test correction and narrow H13 observation. Version 14 adds the 39-test Settings correction, the actual-entry ownership regression and narrow H14 observations. Earlier test totals and H12/H13 results retain their original candidate scope.

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
| A0 | Current SDK v8 host support, callable methods, signed account/age gates and active adapter lifetime. The dashboard SDK selector is **8.0 [Network Enabled Zero Permissions]**. Production remains version **9**, bundle **29168977262783270**; Testing is version **14**, bundle **30477676368485685**, containing the expansion, client subscription ad gate, bounded Settings preparation and captured-account checkout correction. Debug Mode is enabled. The permission-specific Zero Permission Access query reports `standard_access: true`, `advanced_access: false`, tier `BASIC`: BASIC developer-role access is granted; advanced public access is absent. The aggregate privilege still reports `is_live: false`, `is_rejected: true`, `grant_status: REJECTED`, and `access_level: none`. Role-account desktop testing does not establish public availability or product approval. |
| A1 | Product review: Business Verification **Verified**, In App Ads **Approved**. Approved Partner Program, Policy, Quality, In App Purchases, Bot and App Property each **Not Submitted**. Policy/Quality submission controls are disabled. General App Review says UNSUBMITTED while requirements claim a previous review is in progress. The follow-up history returns `submissions: []` and `has_been_previously_reviewed: false`, while the permission-specific query says `in_current_submission: true`. Preserve and reconcile these conflicting responses without inferring a pending or approved review. |
| A2 | Seven catalog products exist. A valid payout account, IAP approval, V2 payment callback/signed-event acceptance and consistent deployed checkout configuration remain outstanding. Recorded deployed commerce is disabled; webhook-ready configuration is absent. No purchase/refund acceptance is claimed. |
| A3 | Existing rewarded/interstitial IDs are configured; both native formats displayed and returned control on exact version 12's desktop developer-role host. Version 13 separately completed the subscription-gated rewarded path for a nonsubscriber. No new ad test was performed on version 14; current-candidate ads, live subscriber and remaining interstitial acceptance remain open. The initial Monetisation Manager inspection found only those two placements. The [later banner setup](evidence/facebook-banner-activation-2026-11-27.md) created Riddle Quest Menu Banner `1748953042991569_1831460981407441` in a dedicated menu space; its observed status was Ready to publish. The client flag and public ID are being enabled for a new Testing artifact. Native banner acceptance remains unproven. Respect authoritative subscription/ad-free eligibility and the banner service deadline. |
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
| 10 | `FBInstant.quit` | W/H12/H14 · H12 preference round trip; H14 native exit to Gaming and same-candidate relaunch restored coconut puzzle and 920 coins | A0; all accepted saves flushed | J04 |
| 11 | `FBInstant.onPause` | W · Lifecycle | A0; registered lifecycle adapter | J02, J09, J10 |
| 12 | `FBInstant.onResume` | W · Lifecycle, optional host signal | A0; browser fallback where absent | J02, J09, J10 |
| 13 | `FBInstant.onContextChange` | W · Contexts/coordinator | A0; active account and locale owner | J06, J07 |
| 14 | `FBInstant.getDisplayMode` | W/H12 · Host environment; native Collapse/Expand mapped to normal/expanded DOM state, getter not traced independently | A0; eligible desktop host | J02 |
| 15 | `FBInstant.onDisplayModeChange` | W/H12 · Host environment; native mode changes reached the game, callback not traced independently | A0; eligible desktop host | J02 |

### Invitations and updates

| # | SDK entry point | Current source inclusion / evidence | Additional prerequisite | Reviewer journey |
| --- | --- | --- | --- | --- |
| 16 | `FBInstant.inviteAsync` | W/H12 · Referral sharing, live-race sharing; general invite opened and cancelled without sending | A0; sharing rollout and audience gates | J03 |
| 17 | `FBInstant.shareAsync` | W/H12 · Result Share opened native Riddle Quest composer; cancellation restored Share/Next Level, no audience choice or send | A0; sharing rollout; valid image/data | J03 |
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
| 25 | `FBInstant.openExternalLinkAsync` | W/H12/H14 · Fixed privacy and terms confirmations identified Riddle Quest and published destinations; Go back restored controls | A0; fixed privacy/terms HTTPS destinations | J04 |
| 26 | `FBInstant.performHapticFeedbackAsync` | W · Haptics | A0; saved opt-in; supported device; no reduced-motion/pause suppression | J05 |
| 27 | `FBInstant.switchGameAsync` | G · No cross-game adapter/destination | A6; real eligible game owned/configured by this business | J13; future explicit cross-promotion journey |

### Advertising

| # | SDK entry point | Current source inclusion / evidence | Additional prerequisite | Reviewer journey |
| --- | --- | --- | --- | --- |
| 28 | `FBInstant.getInterstitialAdAsync` | W/H12 · Ads capability; real interstitial displayed on held qualifying Classic result | A0, A3; configured approved interstitial placement; authoritative eligibility | J09 |
| 29 | `FBInstant.getRewardedVideoAsync` | W/H12/H13 · Ads capability; real version 13 rewarded completion after fresh eligibility gates, seven editable cells restored and coins unchanged | A0, A3; configured rewarded placement; eligible server session | J09 |
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
| 45 | `FBInstant.player.getConnectedPlayersAsync` | W/H12 · Native social displayed Friends who play 0; no nonempty result or player match established | A0; native-social/age/context policy; recently active connections | J06 |

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
| 52 | `FBInstant.context.chooseAsync` | W/H12 · Play with friends opened native chooser; cancellation restored Play with friends/Start PvP, no selection | A0; native social policy and dialog guard | J06 |
| 53 | `FBInstant.context.switchAsync` | W · Native social: solo or actual current Room | A0; valid destination; authoritative reconciliation | J06, J07 |
| 54 | `FBInstant.context.createAsync` | W/H12 · Choose friends showed Service temporarily unavailable and retired through Refresh; failure path only, raw SDK error code not captured | A0; Meta picker and account/context policy | J06 |
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
| 63 | `FBInstant.tournament.getTournamentsAsync` | W/H12 · Native social displayed an empty tournament list; no populated listing or join established | A0; eligible active native tournaments; validated metadata | J07 |
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

Inspect bounded platform/SDK/entry-source diagnostic fields after startup; compare them with the real host. The session metadata contains only the game identifier and online/playing/racing activity. Observe a native desktop display-mode change and confirm layouts/profile overlays remeasure; it is not a fullscreen-toggle control. Background/resume during gameplay, audio, saves and native dialogs, and verify only the current account/lifetime resumes. Verify optional getters/rejected entry reads do not prevent play. Where the display getter initially lacks support, establish later mode observation from the actual host rather than assuming a static startup capability list is exhaustive. Check sanitized event payloads and consent behavior without exposing answers or identity.

### J03 — Invitations, result shares and entry acceptance

Use the general Invite action, a completed-result Share action and a live-race invitation with consenting testers. Verify native dialogs use the expected card and bounded opaque data. Close each dialog without sending, then complete a separately authorized send. A resolved invite promise alone is not delivery evidence and must not grant coins. Open the recipient link and confirm referral or challenge parsing, explicit acceptance where required, correct locale/session binding and no duplicate referral reward. Exercise unsupported invite with supported share fallback, rejected images, stale account ownership and delayed dialog completion.

### J04 — Settings native actions and fixed legal links

Open Settings. On eligible hosts verify **Add to home screen**, **Follow our page**, **Join our group**, **Privacy Policy**, **Terms of Use** and **Quit game**. Validate each eligibility-dependent action independently. Decline the shortcut prompt and ensure it is not requested again in that SDK session. Cancel follow/join and external-link prompts without success messaging; unavailable/unlinked page/group controls must disappear or report unavailable. Legal links must resolve to the fixed published Riddle Quest pages, never entry-provided destinations. Quit only after accepted saves finish; a failed flush must keep the game open with a recoverable notice. Observe cleanup of overlays, banners, presence and retired account operations.

### J05 — Opt-in haptics

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

Complete unique Classic/Daily levels to reach the new three-level interstitial opportunity, respecting cooldown and session caps; repeated result presentation and racing must not increment it. Check accepted subscription suppression for both formats and durable ad removal for interstitials. Backgrounding, leaving the result or changing entitlement while loading must suppress stale display. The earlier version-9 completion is H9 evidence only and cannot certify this candidate's new policy. Version 13's real rewarded completion is H13 nonsubscriber evidence. Its client gate combines fresh configuration with the authenticated account's server-owned subscription field, fails closed when unknown, and permits retry without admitting a native ad. Controlled tests passed for subscribers and subscription changes during loading; native subscriber suppression, durable removal and the remaining variants still require eligible accounts. The direct nested-frame GET trace was not captured.

### J10 — Optional banner format

A separate real banner placement now exists with observed status Ready to publish, and its client activation is being verified for a new Testing artifact; neither fact establishes served-ad acceptance. On a supported eligible host, visit a static Settings or Profile surface and verify reserved bottom space keeps content and controls reachable. Enter gameplay/racing, pause, hide the page or open another native dialog and confirm the banner hides before interaction proceeds. Check no-fill, late load completion, entitlement refresh, hide rejection, retry, account replacement, quit and deletion. A failed hide must retain safe layout/interaction handling; it must not silently release another native dialog over the ad. Confirm subscriber/ad-free eligibility combines fresh configuration with the verified account's server-owned subscription read; unknown authorization must hide the banner and allow only a later eligible-visit retry. Ensure the service deadline disables new loads; the documented phase-out ends 31 March 2027.

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
| AdInstance | `getPlacementID` must exactly match the configured placement before loading and again before showing. Invalid/missing/throwing getters fail closed; current-owner and entitlement checks follow both reads. Actual Meta rewarded and interstitial display/recovery passed on version 12 desktop. Version 13 separately passed the rewarded nonsubscriber path through its fresh entitlement gates; direct GET tracing, live subscriber behavior, new-candidate interstitials and remaining failure/host variants still need their own acceptance. |
| SignedPlayerInfo | Server-verified player ID/signature bound to the issued nonce. |
| SignedASID / SignedAssociatedAppASID | Still part of the missing migration/association authority; no identity merge based only on a browser-returned ID. |
| ConnectedPlayer / ContextPlayer | Validated IDs stay within the Facebook boundary; UI exposes counts, not extracted names/photos. |
| Tournament | ID/end-time/title/context/payload use validated for its flow. All six declared getters have meaningful reachable consumers in the [source audit](evidence/facebook-returned-object-coverage-2026-11-27.md); populated native discovery/join and private-tournament acceptance remain open. |
| LiveMatch | Both declared getters validate match/context IDs during discovery and are reread before a switch, as confirmed in the [source audit](evidence/facebook-returned-object-coverage-2026-11-27.md). Room lookup alone is not hosted co-play acceptance. |
| OverlayView | Profile views use show, direct destroy (legacy dismissal fallback), owned IDs/iframes and stale-owner cleanup. Generic photo events replace the failed view once. No profile content is read back. Other returned-object methods still require a meaningful consumer before being counted. |

## APIs outside the viable current v8 scope

The research inventory establishes that raw player name/photo access was removed for Zero Permissions, native global leaderboards are deprecated/rejecting, old statistics wrappers and rewarded-interstitial JavaScript APIs are absent, and recurring Instant Games subscriptions are unsupported. A favorites/bookmark method was not found in the complete current inventory. These are documented unavailable APIs, not missing integrations to simulate. Recheck official contracts before changing these dispositions. Banners remain an explicitly temporary supported integration during phase-out, not permanent coverage.

The rewarded-video IAP fallback pilot is also not completed: it requires separate approval/product configuration and returns an unsigned fallback result with different grant semantics. Existing normal purchase authority must continue rejecting that shape until a separate authoritative protocol is designed and accepted.

## Exact artifact and release completion gates

- [ ] Resolve every G entry with a real reachable integration or current app/host/contract evidence establishing why it cannot be enabled. Preserve missing prerequisites explicitly; they are not completion evidence.
- [x] Reinspect the client source after concurrent integration work. Earlier reviews addressed Settings ownership, tournament routing, native-display ownership and the version 13 subscription read. Version 14's independent review found no blocker in bounded Settings preparation or captured-account checkout admission; purchase recovery and native-dialog ownership remain unchanged. Exact-host acceptance remains scoped below.
- [x] Complete the Facebook client build and static/archive checks. Canonical `pnpm preflight:facebook-upload` passed for version 14. Its Settings correction passed 39 focused tests across two suites; the real built-entry ownership regression and integrated browser journey passed in 33.233 seconds. The artifact audit covered 420 runtime files, 4.51 MB total and 0.71 MB initial resources, with no Jest gaming SDK, native-module or secret leakage. The earlier 122-test subscription result retains its version 13 scope. Firebase packaging/deployment was not changed or rerun under the owner freeze; deployed backend verification remains open separately.
- [x] Prepare a clean immutable client archive from the agreed release source; record commit, SHA-256, byte count and contents. Version 14 is bound to clean `61fc18b0a3df0d6efd69b2b28eb1eeb3abb8e24f`, SHA-256 `d44c2e9b59b9eea398d8bdd0382149898161a2726bad8ec2d8289a1bb0cae03d`, 2,865,660 bytes, 422 ZIP entries and 420 runtime files. Backend deployment verification remains a separate open gate; its source/configuration is preserved by owner instruction.
- [x] The owner explicitly authorized Facebook test uploads from this checkout on 27 November. The upload CLI now accepts `main` or `facebook`, retaining clean-source, exact-archive and unresolved-handoff gates; other branches are rejected.
- [x] Authorization covers the Facebook uploads needed for testing. Production promotion, review submission and publication remain separate actions requiring their own authorization.
- [x] Confirm the authorized upload finished processing and its exact archive identity, Testing assignment and SDK selector. Version 14 was uploaded once, finished processing and was explicitly assigned to Testing on SDK 8.0 NEZP; the independently downloaded archive matches the recorded SHA-256 and byte count, and the local acceptance receipt is recorded. Production remains version 9. This gate does not establish feature-specific eligibility.
- [ ] Verify the deployed backend revision and feature flags for every server-owned integration; the client archive alone cannot establish receipt, identity, context, tournament, ad-entitlement or notification authority. [Selected metadata is verified for 32 functions](evidence/facebook-deployed-authority-2026-11-27.md), without runtime invocation. The [source comparison](evidence/facebook-deployed-source-comparison-2026-11-27.md) contradicts exact equality with the protected baseline for all three downloaded representatives and identifies missing subscription-based ad suppression in the active configuration source. Version 13 compensates with a client-owned read of the existing server-owned subscription field; local subscriber tests and the hosted nonsubscriber rewarded path passed, without backend repair. Original source-commit correspondence, remaining shared endpoints, live subscriber behavior and other runtime authority still require acceptance; the Firebase freeze remains in force.
- [ ] Finish/reconcile all applicable approvals: Approved Partner Program, Zero Permission Access beyond the granted BASIC role-account scope, Policy, Quality, IAP/payout/payment callbacks, Bot if added, App Property if required, and format-specific ads eligibility. Business Verified and In App Ads Approved cover only those named gates.
- [ ] Complete the relevant J01–J14 journeys on the final hosted candidate, with supported web/mobile hosts, authorized accounts and exact evidence references. Version 14 has only the narrow H14 startup, legal-link cancellation and quit/relaunch check; historical H12/H13 journeys are not current-candidate acceptance. No production/review success may be inferred from an SDK declaration, locally passing build or earlier hosted observation.
- [ ] Verify official page/group associations, genuine cross-play configuration, private-tournament allowlisting, eligible Rooms hosting and the separate banner placement where those integrations are included.
- [ ] Refresh the final reviewer instructions and feature claims to match actual enabled behavior, legal/age disclosures and support/retention operations. Complete owner-required final publication approval before public release.

This checklist deliberately retains outstanding work. It is not a release sign-off and does not declare the active goal complete.
