# Facebook API submission checklist — 27 November 2026

**Status: local candidate coverage and reviewer plan; submission completeness is unproven.** This checklist covers every one of the 79 public SDK entry points in the [current primary-source inventory](facebook-api-research-2026-11-27.md). It records the working-tree implementation being assembled on the owner-requested `facebook` branch. It is not a claim that the candidate was uploaded, approved, or accepted on a Meta host. Changes made after this snapshot must be checked against the final commit and exact artifact.

The scope remains every possible applicable API integration. An absent adapter, missing configuration, missing product surface or missing partner approval is an open item, not a completed integration. Alternative APIs are tracked individually even when one real workflow deliberately selects only one of them. Removed or deprecated unavailable APIs are distinguished at the end.

## Authoritative evidence and status

- [Dashboard prerequisites](evidence/facebook-dashboard-api-prerequisites-2026-11-27.md): current product-specific hosting, review and cross-play observations.
- [Connector review JSON](evidence/facebook-live-review-state-2026-11-27.json): app-review status, requirements and individual privileges. There is no separate dashboard-prerequisites JSON.
- [Recorded version 9 upload](evidence/facebook-campaign-activation-2026-11-26.json): source `af20085bce70fbe73aedebce68975a414d9dac20`, archive SHA-256 `11b614b7c7d483041b689c5ba9750468da37a3a6a5824b7e85f4369eca99dcca`.
- [Hosted rewarded continuation](evidence/facebook-rewarded-ad-setup-2026-11-27.md): one real version-9 video and successful continuation; not the new ad cadence, subscriber policy or new candidate.
- [Payment configuration and deployment evidence](evidence/facebook-payments-catalog-2026-11-27.md): catalog exists; payout, approval, webhook readiness and checkout activation remain open.
- [Expanded API build](evidence/facebook-expanded-api-build-2026-11-27.md): the first completed candidate unit built after session-score wiring, with 418 files, 4.48 MB total and 0.69 MB initial resources; hosted acceptance remains open.
- [Combined expanded candidate verification](evidence/facebook-expanded-api-final-verification-2026-11-27.md): 398 focused tests, the expanded local browser journey and backend preflight passed. The production build contains 420 files, 4.50 MB total and 0.70 MB initial resources.
- [Earlier source coverage](evidence/facebook-api-coverage-2026-11-27.md): historical baseline, superseded by this checklist's broader scope for future work.

| Code | What the evidence establishes |
| --- | --- |
| W | Source implementation and its entry/UI wiring were inspected. Final artifact inclusion and hosted acceptance are still required. |
| C | Implementation is wired conditionally but provider/deployment prerequisites prevent claiming an active integration. |
| G | Integration gap: no reachable implementation or complete meaningful workflow was found. |
| H9 | Narrow historical hosted observation in version 9 only. Every changed flow still needs final-candidate acceptance. |

None of these codes means the final submission requirement is complete. The [combined candidate verification](evidence/facebook-expanded-api-final-verification-2026-11-27.md) covers the later private-tournament, Messenger-consent and generic-overlay additions. The owner explicitly authorized focused tests and browser verification on 27 November. All 398 focused tests and the expanded local injected-SDK browser journey passed. No fresh hosted acceptance is implied by source inspection or local checks.

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
| Ads / banner | [FacebookAdsCapability.ts](../../platforms/web/facebook/src/FacebookAdsCapability.ts), [FacebookLevelInterstitial.ts](../../platforms/web/facebook/src/FacebookLevelInterstitial.ts), [FacebookRewardedContinue.ts](../../platforms/web/facebook/src/FacebookRewardedContinue.ts), [ads/FacebookBanner.ts](../../platforms/web/facebook/src/ads/FacebookBanner.ts), [ads/FacebookBannerLayout.tsx](../../platforms/web/facebook/src/ads/FacebookBannerLayout.tsx) |
| Commerce / recovery | [FacebookCommerceSession.ts](../../platforms/web/facebook/src/FacebookCommerceSession.ts), [FacebookCommerceCapability.ts](../../platforms/web/facebook/src/FacebookCommerceCapability.ts), [FacebookPurchaseRecovery.ts](../../platforms/web/facebook/src/FacebookPurchaseRecovery.ts) |
| Profile overlays | [FacebookOverlayCapability.ts](../../platforms/web/facebook/src/FacebookOverlayCapability.ts) |
| Notification consent | [FacebookCampaignNotifications.ts](../../platforms/web/facebook/src/FacebookCampaignNotifications.ts); delivery/content remain with the notification manager |
| Messenger permission | [notifications/FacebookMessengerBotConsent.ts](../../platforms/web/facebook/src/notifications/FacebookMessengerBotConsent.ts), exposed through Settings actions; independent of manager consent |

## Provider and deployment prerequisites

| ID | Requirement and currently observed state |
| --- | --- |
| A0 | Current SDK v8 host support, callable methods, signed account/age gates and active adapter lifetime. The dashboard SDK selector is **8.0 [Network Enabled Zero Permissions]**. Production is version **9**, bundle **29168977262783270**; Testing remains version **6**. Both predate this source expansion. Debug Mode is enabled. Zero Permission Access is rejected/not live in connector privileges, so public capability access is not proven. |
| A1 | Product review: Business Verification **Verified**, In App Ads **Approved**. Approved Partner Program, Policy, Quality, In App Purchases, Bot and App Property each **Not Submitted**. Policy/Quality submission controls are disabled. General App Review says UNSUBMITTED while requirements claim a previous review is in progress; resolve this discrepancy without treating either response as product approval. |
| A2 | Seven catalog products exist. A valid payout account, IAP approval, V2 payment callback/signed-event acceptance and consistent deployed checkout configuration remain outstanding. Recorded deployed commerce is disabled; webhook-ready configuration is absent. No purchase/refund acceptance is claimed. |
| A3 | Existing rewarded/interstitial IDs are configured; one version-9 rewarded flow was observed. Monetisation Manager has two ad spaces containing exactly those two placements; no banner placement exists. Banner requires its own approved placement and `VITE_FACEBOOK_BANNER_ENABLED=true` plus `VITE_FACEBOOK_BANNER_PLACEMENT_ID`. Respect authoritative subscription/ad-free eligibility and the banner service deadline. |
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
| 10 | `FBInstant.quit` | W · Settings actions | A0; all accepted saves flushed | J04 |
| 11 | `FBInstant.onPause` | W · Lifecycle | A0; registered lifecycle adapter | J02, J09, J10 |
| 12 | `FBInstant.onResume` | W · Lifecycle, optional host signal | A0; browser fallback where absent | J02, J09, J10 |
| 13 | `FBInstant.onContextChange` | W · Contexts/coordinator | A0; active account and locale owner | J06, J07 |
| 14 | `FBInstant.getDisplayMode` | W · Host environment | A0; eligible desktop host | J02 |
| 15 | `FBInstant.onDisplayModeChange` | W · Host environment | A0; eligible desktop host | J02 |

### Invitations and updates

| # | SDK entry point | Current source inclusion / evidence | Additional prerequisite | Reviewer journey |
| --- | --- | --- | --- | --- |
| 16 | `FBInstant.inviteAsync` | W · Referral sharing, live-race sharing | A0; sharing rollout and audience gates | J03 |
| 17 | `FBInstant.shareAsync` | W · Referral sharing, live-race sharing | A0; sharing rollout; valid image/data | J03 |
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
| 23 | `FBInstant.canCreateShortcutAsync` | W · Settings actions | A0; eligible home-screen host/player | J04 |
| 24 | `FBInstant.createShortcutAsync` | W · Settings actions | A0; positive eligibility; one attempt per SDK session | J04 |
| 25 | `FBInstant.openExternalLinkAsync` | W · Settings actions | A0; fixed privacy/terms HTTPS destinations | J04 |
| 26 | `FBInstant.performHapticFeedbackAsync` | W · Haptics | A0; saved opt-in; supported device; no reduced-motion/pause suppression | J05 |
| 27 | `FBInstant.switchGameAsync` | G · No cross-game adapter/destination | A6; real eligible game owned/configured by this business | J13; future explicit cross-promotion journey |

### Advertising

| # | SDK entry point | Current source inclusion / evidence | Additional prerequisite | Reviewer journey |
| --- | --- | --- | --- | --- |
| 28 | `FBInstant.getInterstitialAdAsync` | W · Ads capability, level interstitial policy | A0, A3; configured approved interstitial placement; authoritative eligibility | J09 |
| 29 | `FBInstant.getRewardedVideoAsync` | W/H9 · Ads capability, rewarded continue | A0, A3; configured rewarded placement; eligible server session | J09 |
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
| 45 | `FBInstant.player.getConnectedPlayersAsync` | W · Native social aggregate count | A0; native-social/age/context policy; recently active connections | J06 |

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
| 52 | `FBInstant.context.chooseAsync` | W · Context chooser | A0; native social policy and dialog guard | J06 |
| 53 | `FBInstant.context.switchAsync` | W · Native social: solo or actual current Room | A0; valid destination; authoritative reconciliation | J06, J07 |
| 54 | `FBInstant.context.createAsync` | W · Native social: Choose friends | A0; Meta picker and account/context policy | J06 |
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
| 63 | `FBInstant.tournament.getTournamentsAsync` | W · Native social listing | A0; eligible active native tournaments; validated metadata | J07 |
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

Complete unique Classic/Daily levels to reach the new three-level interstitial opportunity, respecting cooldown and session caps; repeated result presentation and racing must not increment it. Check accepted subscription suppression for both formats and durable ad removal for interstitials. Backgrounding, leaving the result or changing entitlement while loading must suppress stale display. The earlier version-9 completion is H9 evidence only and cannot certify this candidate's new policy.

### J10 — Optional banner format

This journey is blocked until a real approved banner placement and explicit deployment flag exist. With them, visit an eligible idle/lobby surface and verify reserved bottom space keeps content and controls reachable. Enter gameplay/racing, pause, hide the page or open another native dialog and confirm the banner hides before interaction proceeds. Check no-fill, late load completion, entitlement refresh, hide rejection, retry, account replacement, quit and deletion. A failed hide must retain safe layout/interaction handling; it must not silently release another native dialog over the ad. Confirm subscriber/ad-free eligibility uses authoritative configuration. Ensure the service deadline disables new loads; the documented phase-out ends 31 March 2027.

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
| AdInstance | `getPlacementID` must exactly match the configured placement before loading and again before showing. Invalid/missing/throwing getters fail closed; current-owner and entitlement checks follow both reads. Actual Meta `loadAsync`/`showAsync` acceptance remains required. |
| SignedPlayerInfo | Server-verified player ID/signature bound to the issued nonce. |
| SignedASID / SignedAssociatedAppASID | Still part of the missing migration/association authority; no identity merge based only on a browser-returned ID. |
| ConnectedPlayer / ContextPlayer | Validated IDs stay within the Facebook boundary; UI exposes counts, not extracted names/photos. |
| Tournament | ID/end-time/title/context/payload use validated for its flow. Type/getter coverage must be checked individually where only declarations exist. |
| LiveMatch | Validate match/context IDs and re-read the current match before a switch; Room lookup alone is not hosted co-play acceptance. |
| OverlayView | Profile views use show, direct destroy (legacy dismissal fallback), owned IDs/iframes and stale-owner cleanup. Generic photo events replace the failed view once. No profile content is read back. Other returned-object methods still require a meaningful consumer before being counted. |

## APIs outside the viable current v8 scope

The research inventory establishes that raw player name/photo access was removed for Zero Permissions, native global leaderboards are deprecated/rejecting, old statistics wrappers and rewarded-interstitial JavaScript APIs are absent, and recurring Instant Games subscriptions are unsupported. A favorites/bookmark method was not found in the complete current inventory. These are documented unavailable APIs, not missing integrations to simulate. Recheck official contracts before changing these dispositions. Banners remain an explicitly temporary supported integration during phase-out, not permanent coverage.

The rewarded-video IAP fallback pilot is also not completed: it requires separate approval/product configuration and returns an unsigned fallback result with different grant semantics. Existing normal purchase authority must continue rejecting that shape until a separate authoritative protocol is designed and accepted.

## Exact artifact and release completion gates

- [ ] Resolve every G entry with a real reachable integration or current app/host/contract evidence establishing why it cannot be enabled. Preserve missing prerequisites explicitly; they are not completion evidence.
- [ ] Reinspect the final source after concurrent integration work, including session-score wiring, teardown, locale keys, dialog ownership, optional banners and cross-target boundaries.
- [ ] Complete the final Facebook build and required static/backend packaging checks. Record the exact commands/results and any limitations. Repeat the owner-authorized focused tests and browser journey for the final source changes.
- [ ] Prepare a clean immutable archive from the agreed release source; record commit, SHA-256, byte count, contents and matching backend revisions/configuration. A package from version 9 or an earlier dirty source does not qualify.
- [x] The owner explicitly authorized Facebook test uploads from this checkout on 27 November. The upload CLI now accepts `main` or `facebook`, retaining clean-source, exact-archive and unresolved-handoff gates; other branches are rejected.
- [x] Authorization covers the Facebook uploads needed for testing. Production promotion, review submission and publication remain separate actions requiring their own authorization.
- [ ] After an authorized upload, confirm the exact new bundle/version has finished processing, the intended Testing/Production assignment, SDK selector/configuration and exact archive identity. Current dashboard Production version 9 and Testing version 6 do not contain this candidate.
- [ ] Verify the deployed backend revision and feature flags for every server-owned integration; the client archive alone cannot establish receipt, identity, context, tournament, ad-entitlement or notification authority.
- [ ] Finish/reconcile all applicable approvals: Approved Partner Program, Zero Permission Access, Policy, Quality, IAP/payout/payment callbacks, Bot if added, App Property if required, and format-specific ads eligibility. Business Verified and In App Ads Approved cover only those named gates.
- [ ] Complete the relevant J01–J14 journeys on the final hosted candidate, with supported web/mobile hosts, authorized accounts and exact evidence references. No production/review success may be inferred from an SDK declaration, locally passing build or a version-9 observation.
- [ ] Verify official page/group associations, genuine cross-play configuration, private-tournament allowlisting, eligible Rooms hosting and the separate banner placement where those integrations are included.
- [ ] Refresh the final reviewer instructions and feature claims to match actual enabled behavior, legal/age disclosures and support/retention operations. Complete owner-required final publication approval before public release.

This checklist deliberately retains outstanding work. It is not a release sign-off and does not declare the active goal complete.
