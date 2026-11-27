# Facebook Instant Games API inventory — 27 November 2026

This is a primary-source research inventory for the goal that the Facebook submission include every available integration. It is not hosted acceptance, approval, deployment or upload evidence. The baseline inspected was `facebook` at `62ae0e4003d4fdb00b93c987aad0b1fda2ec6b59`; implementation work after that revision must be assessed separately.

The target loads the [public v8.0 JavaScript SDK](https://connect.facebook.net/en_US/fbinstant.8.0.js). The SDK downloaded during this research has SHA-256 `dd2389a25105d5c9247c9bafb66152bcb2302b0cb25aef10b2635bda8d858c17`. Its public entry points were checked against the current [v8 reference](https://developers.facebook.com/documentation/games/sdk-reference/v8.0), each module reference below, and the [Zero Permissions reference](https://developers.facebook.com/documentation/games/build/zero-permissions/api-reference). Meta's documentation was retrieved as Markdown with `Accept: text/markdown`; the Meta documentation connector independently located the same canonical URLs.

## Scope and proof

The inventory below covers 79 documented public SDK entry points: 78 method headings across the root and seven module references, plus `player.getAssociatedAppsASIDAsync`, which is documented in the root changelog and cross-play guide and present in the current SDK. Returned-object operations are listed separately. Constructors and SDK internals are not game integrations.

Coverage requires a usable game behavior, valid capability and account gates, correct failure/cancellation handling, and the required configuration. A declaration or dormant adapter does not establish a working integration. A former statement that a feature has “no current game use” is a product gap to assess under this goal, not evidence that Meta lacks the API. Conversely, calling deprecated methods cannot create working platform coverage.

Repository constraints continue to apply: Facebook code stays in its platform boundary; identity, paid grants and referral rewards stay server-authoritative; gameplay does not own notification content, scheduling, delivery or tap handling. This research did not execute tests or browser harnesses.

## Complete SDK entry-point inventory

In each row, unqualified names belong to the prefix in the first column. Optional functionality must check both the current host's `getSupportedAPIs()` result and callable method availability.

| Prefix / family | Public entry points | Baseline finding and required coverage |
| --- | --- | --- |
| `FBInstant` startup | `initializeAsync`, `setLoadingProgress`, `startGameAsync`, `getSupportedAPIs` | Present in `FacebookPlatformBootstrap`. Preserve initialization order and game-ready signaling. |
| `FBInstant` environment / entry | `getLocale`, `getPlatform`, `getSDKVersion`, `getEntryPointData`, `getEntryPointAsync` | Locale and entry payload are present; platform, SDK version and entry-source diagnostics are candidates. |
| `FBInstant` lifecycle / desktop | `quit`, `onPause`, `onResume`, `onContextChange`, `getDisplayMode`, `onDisplayModeChange` | Lifecycle and quit are present; desktop mode integration is a candidate. |
| `FBInstant` social | `inviteAsync`, `shareAsync`, `updateAsync` | Present. Keep native cancellation semantics, translated copy and server-issued opaque entry data. |
| `FBInstant` scores / session | `postSessionScore`, `postSessionScoreAsync`, `setSessionData`, `logEvent` | Events present. Comparable activity-end session scoring and bounded session metadata remain candidates. Synchronous and asynchronous score methods are alternatives, not two submissions for one result. |
| `FBInstant` engagement | `canCreateShortcutAsync`, `createShortcutAsync`, `openExternalLinkAsync`, `performHapticFeedbackAsync`, `switchGameAsync` | Shortcuts present. Approved external links and preference-controlled haptics are candidates. Cross-promotion requires a real target game. |
| `FBInstant` ads | `getInterstitialAdAsync`, `getRewardedVideoAsync`, `loadBannerAdAsync`, `hideBannerAdAsync` | Interstitial/rewarded present. Banners remain available during deprecation but need an approved placement, reserved layout and entitlement/lifecycle controls. |
| `FBInstant` matchmaking / current tournament | `checkCanPlayerMatchAsync`, `matchPlayerAsync`, `getTournamentAsync` | Present. Current native context and server race membership must remain synchronized. |
| `FBInstant.player` identity | `getID`, `getASIDAsync`, `getSignedASIDAsync`, `getAssociatedAppsASIDAsync`, `getSignedAssociatedAppsASIDAsync`, `getSignedPlayerInfoAsync`, `getAgeCategoryAsync` | Signed player identity and age present. ASID/associated-app methods require an actual migration or cross-play use and eligible app associations. |
| `FBInstant.player` save | `getDataAsync`, `setDataAsync`, `flushDataAsync` | Present. These persist game save/preferences; they do not confer economic authority. |
| `FBInstant.player` connections | `getConnectedPlayersAsync` | Candidate for native friend selection or a Meta-rendered connected-player list. |
| `FBInstant.player` notifications | `canSubscribeBotAsync`, `isSubscribedBotAsync`, `subscribeBotAsync`, `createNEZPNotificationContentAsync` | Candidate only through an adapter controlled by the existing notification manager. Existing A2U consent is not proof of these individual SDK operations. |
| `FBInstant.context` | `getID`, `getType`, `chooseAsync`, `switchAsync`, `createAsync`, `getPlayersAsync` | ID/type/chooser present. Direct group creation, leave-to-solo, context switching and membership presentation are candidates. |
| `FBInstant.payments` | `onReady`, `getCatalogAsync`, `purchaseAsync`, `getPurchasesAsync`, `consumePurchaseAsync` | Present. Native purchase UI still requires IAP approval, catalog and payout configuration. |
| `FBInstant.tournament` | `createAsync`, `createPrivateAsync`, `getTournamentsAsync`, `joinAsync`, `postScoreAsync`, `shareAsync` | Public create/share/post present. Eligible tournament discovery/join and allowlisted private tournaments are gaps to address or prove unavailable. |
| `FBInstant.community` | `canFollowOfficialPageAsync`, `canJoinOfficialGroupAsync`, `followOfficialPageAsync`, `joinOfficialGroupAsync` | Present behind eligibility checks. Actual page/group links must exist. |
| `FBInstant.room` | `getCurrentMatchAsync` | Documented Messenger Rooms integration. Requires a real current live-match host; a generic race lobby is not that host. |
| `FBInstant.overlayViews` factories | `createOverlayViewAsync`, `createOverlayViewWithXMLStringAsync`, `createOverlayView`, `createOverlayViewWithXMLString`, `createProfilePictureOverlayViewAsync`, `createProfileNameOverlayViewAsync` | Current-player convenience overlays present. Generic XML factories support richer player lists. Promise/callback and file/inline forms are alternatives. |
| `FBInstant.overlayViews` management | `setCustomEventHandler`, `getOverlayViews` | Useful for Meta-rendered social choices and overlay lifecycle diagnostics; not yet used at baseline. |

Sources: [core and ads](https://developers.facebook.com/documentation/games/sdk-reference/v8.0), [player](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/player), [context](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/context), [payments](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/payments), [tournament](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/tournament), [community](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/community), [room](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/room), [overlays](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/overlayViews), [cross-play](https://developers.facebook.com/documentation/games/build/zero-permissions/onboarding-and-migration/cross-play-management).

## Returned-object operations

These are part of their owning integration, rather than additional independent platform features:

| Object | Public operations |
| --- | --- |
| `AdInstance` | `getPlacementID()`, `loadAsync()`, `showAsync()` |
| `SignedPlayerInfo` | `getPlayerID()`, `getSignature()` |
| `SignedASID` | `getASID()`, `getSignature()` |
| `SignedAssociatedAppASID` | `getAppID()`, `getASID()`, `getSignature()` |
| `ConnectedPlayer`, `ContextPlayer` | `getID()`; direct names/photos are unavailable |
| `Tournament` | `getID()`, `getContextID()`, `getEndTime()`, `getTournamentType()`, `getTitle()`, `getPayload()` |
| `LiveMatch` | `getID()`, `getContextID()` |
| `OverlayView` | `getID()`, `getIFrameElement()`, `getStatus()`, `getInitialData()`, `getErrors()`, `showAsync()`, `updateAsync()`, `dismissAsync()`, `destroyAsync()` |

Use the module sources above. `OverlayView.destroyAsync()` is now an explicitly documented permanent teardown operation; the baseline type comment calling it only a runtime extension is outdated. `dismissAsync()` hides a reusable view, while destruction removes it and rejects outstanding operations. [Overlay lifecycle](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/overlayViews#destroyasync)

## Contracts that affect implementation

### Contexts and connected players

- `context.createAsync(suggestedPlayerIDs?: string | string[]): Promise<void>` supports one connected player, several, or no argument for Meta's friend picker.
- `context.switchAsync(id: string, switchSilentlyIfSolo?: boolean): Promise<void>` accepts `"SOLO"` for leaving social play; native confirmation or eligibility may reject the request.
- `context.getPlayersAsync(): Promise<ContextPlayer[]>` may include the current player. It represents players active in that context within 90 days; it is not a live online-presence list.
- `player.getConnectedPlayersAsync(): Promise<ConnectedPlayer[]>` also describes recent connected players, not current online status. Keep raw IDs inside the Facebook integration and display identity through overlays.
- `context.getType()` documents `POST | THREAD | GROUP | SOLO`; the baseline local union lacks `POST`.

Sources: [context reference](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/context), [connected players](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/player#getconnectedplayersasync).

### Tournaments

`tournament.getTournamentsAsync(): Promise<Tournament[]>` returns eligible active tournaments. `tournament.joinAsync(tournamentID: string): Promise<void>` switches context and can fail when participation/connected-player requirements are unmet. `getPayload()` returns a JSON string or null; use the existing strict entry decoder and server validation before selecting a game mode. `getTournamentType()` returns `DEFAULT | PRIVATE | DAILY | PAGE_HOSTED`, and `getTitle()` returns string or null. [Tournament reference](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/tournament)

`createPrivateAsync({initialScore: number, data?: object}): Promise<Tournament>` requires a Messenger group thread, an app allowlist and per-player rollout. `context.chooseAsync({minSize: 3})` can select the required thread. Settings come from App Dashboard, not a caller configuration object. Creation may join an existing tournament; server score rejection may still leave the chat tournament created without switching the player into it. This needs explicit recovery, valid score semantics and partner enablement. [Private tournament contract](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/tournament#createprivateasync)

### Session scoring, entry and diagnostics

`postSessionScore(score: number): void` and `postSessionScoreAsync(score: number): Promise<void>` require a comparable integer score at activity end. The async version can display platform UI and change context before it resolves. Use one canonical game score definition and an idempotent end-of-activity trigger; do not post unrelated coin balances or repeatedly submit the same result. `setSessionData(object): void` accepts at most 1,000 JSON characters and can feed game-play webhooks. These are integration constraints, not permission to move reward authority into the client. [Score and session reference](https://developers.facebook.com/documentation/games/sdk-reference/v8.0#postsessionscoreasync)

`getPlatform()` is nullable before initialization; documented platforms are `IOS`, `ANDROID`, `WEB`, `MOBILE_WEB`. `getSDKVersion()` returns a string. `getEntryPointAsync(): Promise<string>` should run only after `startGameAsync` resolves. Bound diagnostic fields and do not include identity, raw errors or arbitrary entry payloads. [Environment reference](https://developers.facebook.com/documentation/games/sdk-reference/v8.0#getentrypointasync)

### Haptics, desktop layout and external links

`performHapticFeedbackAsync(): Promise<void>` requests host feedback. The proposed product use is an explicit saved preference and bounded success feedback; unsupported hosts should remain unaffected. `openExternalLinkAsync(url: string): Promise<void>` accepts approved absolute HTTP(S) destinations, prompts through Meta and can reject on cancellation. Use fixed privacy/help destinations, not arbitrary entry-provided URLs. [Utility reference](https://developers.facebook.com/documentation/games/sdk-reference/v8.0#openexternallinkasync)

`getDisplayMode(): 'NORMAL' | 'EXPANDED' | 'FULLSCREEN' | null` is read-only and applies to supported desktop players. `onDisplayModeChange(callback): void` has no documented disposer and does not immediately call the callback. Initial mode observation may arrive after initialization; the supported-API entry for the getter can appear at that point. These methods do not grant fullscreen control or report browser F11 mode. Guard callbacks by adapter lifetime and read fresh support when observation starts. [Display mode contract](https://developers.facebook.com/documentation/games/sdk-reference/v8.0#getdisplaymode)

## Deprecated, removed and prerequisite-gated features

| Feature | Current source-backed disposition |
| --- | --- |
| Raw names and photos | `player.getName()` / `getPhoto()` were removed for Zero Permissions. Use Meta overlays. [Migration reference](https://developers.facebook.com/documentation/games/build/zero-permissions/api-reference#what-changed-in-v80) |
| Native global leaderboards | `globalLeaderboards.setScoreAsync`, `getScoreAsync`, `getTopEntriesAsync`, `getTopFriendEntriesAsync` reject with `DEPRECATED_GLOBAL_LEADERBOARD_ERROR` in Zero Permissions. Keep authoritative server boards and overlay presentation. [Deprecation](https://developers.facebook.com/documentation/games/build/zero-permissions/api-reference#global-leaderboards-fbinstantgloballeaderboards--deprecated) |
| Statistics wrappers | `getStatsAsync`, `setStatsAsync`, `incrementStatsAsync` are absent from both current v8 references and the downloaded SDK. They are not an available integration to add. |
| Rewarded interstitial | Deprecated in 2025; `getRewardedInterstitialAsync` is absent from the current v8 SDK. Meta's Unity wrapper still listing the method is not evidence it works in this JavaScript target. [Banner FAQ](https://developers.facebook.com/documentation/games/monetize/in-app-ads/banner-ads#deprecation-faq) |
| Banner ads | `loadBannerAdAsync(placementID, position?: 'top' | 'bottom'): Promise<void>` and `hideBannerAdAsync(): Promise<void>` remain documented during phase-out. Impressions are decreasing and cease on 31 March 2027. Current inclusion requires a real placement; keep this separately identifiable for removal. [Banner guide](https://developers.facebook.com/documentation/games/monetize/in-app-ads/banner-ads) |
| Recurring subscriptions | Unsupported by Instant Games IAP. Do not invent a Facebook subscription checkout. [IAP product types](https://developers.facebook.com/documentation/games/monetize/in-app-purchases#subscriptions---not-supported) |
| Purchase `developerPayload` | No longer populated after 30 October 2026. Use signed `purchaseToken` for deduplication. [IAP deprecation](https://developers.facebook.com/documentation/games/monetize/in-app-purchases) |
| Rewarded-video purchase fallback | Limited pilot requiring IAP and ads approval, a DFC fallback product and a preloaded ad. The fallback returns empty purchase token/signature and `paymentActionType: 'rewarded_video_fallback'`; its reward product differs from the originally requested product. Do not enable until a server-authoritative reward protocol is established. [Fallback beta](https://developers.facebook.com/documentation/games/monetize/in-app-purchases#rewarded-video-ad-fallback-beta) |
| Associated-app identity | Requires genuine same-game, same-business app association. Dashboard linking includes an attestation and cannot be undone through that interface. Use signed association data for any authoritative account link; never synthesize destination app IDs. [Cross-play management](https://developers.facebook.com/documentation/games/build/zero-permissions/onboarding-and-migration/cross-play-management) |
| `getASIDAsync` / `getSignedASIDAsync` | Limited to legacy/migrated users who meet the documented eligibility. The normal identity remains the Instant Games player ID. [Player identity](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/player) |
| Private tournaments | Partner allowlist and player rollout; keep unavailable state explicit until enabled. [Private tournament access](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/tournament#createprivateasync) |
| Favorites / bookmark APIs | No corresponding public method was found in the complete current v8 inventory or SDK. Documented home-screen shortcuts are the supported integration. |

## Server APIs, app settings and submission gates

These integrations cannot be established by adding browser calls alone:

- **Notifications:** A2U uses the app's `notifications` Graph edge, an app access token and the Instant Games player ID. It supports media, optional scheduling/deep links and stored NEZP notification content/carousels. Keep app tokens, scheduling, consent decisions and content in the notification manager. A successful send response is not display/tap evidence. `createNEZPNotificationContentAsync` may supply a provider-rendered content ID through a manager-owned bridge, but must not become a second gameplay notification service. [A2U API](https://developers.facebook.com/documentation/games/retain/notifications/a2u-api)
- **Commerce:** IAP approval, payout/business setup, DFC product configuration, server signature verification and payment webhooks remain necessary. Catalog V1 and regional-pricing V2 are administrative server operations, not a reason to expose app secrets to the game. The pilot fallback's unsigned receipt shape must not bypass the normal signed grant flow. [IAP setup and catalog](https://developers.facebook.com/documentation/games/monetize/in-app-purchases)
- **Ads:** Each enabled format requires its own valid Audience Network placement and eligible inventory. Preserve subscriber exclusion, explicit rewarded choices and authoritative claims. [Interstitial guide](https://developers.facebook.com/documentation/games/monetize/in-app-ads/interstitial-ads)
- **Community:** The official page must be linked to the app; the official group must be associated appropriately. A supported method with a missing association can reject with `PAGE_NOT_LINKED` / `GROUP_NOT_LINKED`. [Community SDK](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/community), [association guide](https://developers.facebook.com/documentation/games/retain/pages-and-groups)
- **Private tournaments:** App Dashboard score settings, any score-validation endpoint and partner enablement must agree with authoritative game scoring. [Tournament guide](https://developers.facebook.com/documentation/games/retain/tournaments)
- **Zero Permissions review:** Bundle targeting, external-domain declarations, app-level access and game review must be verified in the actual App Dashboard. Standard developer-role availability is not proof of public rollout eligibility. The migration guide describes the advanced-access and rollout sequence; its end-state access behavior differs from an in-progress migration, so inspect live app state rather than inferring it from one flag. [NEZP migration](https://developers.facebook.com/documentation/games/build/zero-permissions/onboarding-and-migration/migrating-to-nezp)

## Next implementation and acceptance work

1. Add meaningful player-facing uses for contexts/connected players, eligible native tournament discovery/join, opt-in haptics and platform-approved links. Build on the existing Facebook dialog gate, strict entry decoder and server reconciliation.
2. Add display/session diagnostics and a defensible activity-end score model. Distinguish user-visible behavior from diagnostic accessors in the completion matrix.
3. Record app-specific eligibility for banners, private tournaments, associated apps, Messenger Rooms, bot subscriptions and purchase fallback. Do not describe missing configuration as a completed integration.
4. Correct the baseline omissions: `POST` context type and documented overlay destruction. Add native tournament title/type getters where the new discovery UI needs them.
5. Inspect the exact submission bundle and exercise supported native flows on authorized Meta hosts, including cancellations, empty lists, unsupported capabilities, stale account/context changes and failed saves. Record artifact hash/version, host/API support and observed behavior per family. Builds and source checks alone cannot prove native acceptance.

The earlier [API coverage record](evidence/facebook-api-coverage-2026-11-27.md) remains historical evidence for its revision. Its “no current game use” exclusions are inputs to this broader goal; they are not the final completion criteria.
