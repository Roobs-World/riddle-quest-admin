# Facebook API coverage — 27 November 2026

This records the implementation and local build of the Facebook API expansion on
the `facebook` branch. It is not evidence of a Meta-hosted acceptance run, an
upload, or a platform configuration change. Tests and browser harnesses were
not executed. The [earlier parity and ad record](facebook-api-parity-and-ad-cadence-2026-11-27.md)
describes the preceding completed unit.

The target uses the [Instant Games v8 reference](https://developers.facebook.com/documentation/games/sdk-reference/v8.0)
and [Zero Permissions contract](https://developers.facebook.com/documentation/games/build/zero-permissions/api-reference).
Optional features require both advertised support and callable SDK methods. A
method's presence in the reference does not establish availability for this app,
player, or host. Shared game code receives target capabilities; it does not
import FBInstant. The Jest browser SDK is absent from this branch; Jest server
identity, purchase, subscription, referral, notification and account integrations
remain supported.

## Existing integration

| Game behavior | SDK operations used | Source boundary |
| --- | --- | --- |
| Startup and language | `initializeAsync`, `setLoadingProgress`, `startGameAsync`, `getSupportedAPIs`, `getLocale` | `FacebookPlatformBootstrap` |
| Verified identity and audience | `player.getID`, nonce-bound `player.getSignedPlayerInfoAsync`, `player.getAgeCategoryAsync` | `credentialExchange`, `FacebookCapabilityPolicy`, server identity exchange |
| Preferences and save recovery | `player.getDataAsync`, `player.setDataAsync`, `player.flushDataAsync` | `FacebookPlatformBootstrap`, account-owned persistence |
| Referral and challenge entry | `getEntryPointData` | Validated opaque referral tokens and challenge/tournament envelopes; explicit acceptance where required |
| Invites and share cards | `inviteAsync`, `shareAsync` | `FacebookLiveRaceSharing`, `FacebookReferralSharing`; invitation results grant no rewards |
| Native contexts | `context.getID`, `context.getType`, `context.chooseAsync`, `onContextChange` | `FacebookContextCoordinator`; reconciles server membership and locale on native context changes |
| Native matchmaking | `checkCanPlayerMatchAsync`, `matchPlayerAsync` | Optional live-race matching through the context coordinator |
| Context challenge updates | `updateAsync` with `notification: "NO_PUSH"` | `contextChallenges`; explicit player action and configured update template |
| Current-player identity presentation | `overlayViews.createProfilePictureOverlayViewAsync`, `overlayViews.createProfileNameOverlayViewAsync`, overlay show/dismiss | `FacebookOverlayCapability`; Meta controls names and photos |
| Official tournament presentation | `getTournamentAsync`, `tournament.createAsync`, `tournament.shareAsync`, `tournament.postScoreAsync` | `FacebookTournamentPresentation`; server-derived adjusted milliseconds, lower-is-better, exact daily window |
| Paid products and recovery | `payments.onReady`, `payments.getCatalogAsync`, `payments.purchaseAsync`, `payments.getPurchasesAsync`, `payments.consumePurchaseAsync` | Server verification/grant before consumption; signed purchase reconciliation |
| Ads | `getRewardedVideoAsync`, `getInterstitialAdAsync`, ad load/show | `FacebookAdsCapability`; authoritative subscription eligibility, earned-reward claim and bounded cadence |
| Analytics | `logEvent` | `analytics`; bounded event fields and active account lifetime |
| Lifecycle | `onPause`, optional `onResume` | `createFacebookLifecycle`; shared subscriber fan-out and removable browser resume fallback |
| Notification consent and delivery | No additional browser bot SDK | `FacebookCampaignNotifications` records explicit consent; the existing notification manager owns A2U content, scheduling and sending |

This list distinguishes direct SDK calls from game features. Context creation,
context switching and tournament joining can occur inside Meta dialogs or entry
flows without this client directly calling every alternative SDK method.

## Expansion in this unit

| Player action | SDK contract | Integration constraints |
| --- | --- | --- |
| Invite friends from general game UI | `inviteAsync(payload): Promise<void>`; `shareAsync` fallback | Native invite support must not depend on share support. Invite, result-share and race-share availability are independent. A closed invite dialog does not prove an invitation was sent. |
| Share a completed result | `shareAsync(payload): Promise<void>` | Explicit result-screen action with the existing bounded card/payload pipeline. No automatic messages or grants. |
| Add to home screen | `canCreateShortcutAsync(): Promise<boolean>`, `createShortcutAsync(): Promise<void>` | Visible only when eligible. At most one SDK creation attempt per session, including a declined prompt. |
| Follow the official page | `community.canFollowOfficialPageAsync(): Promise<boolean>`, `community.followOfficialPageAsync(): Promise<void>` | Independent eligible Settings action; requires a linked official game page. |
| Join the official group | `community.canJoinOfficialGroupAsync(): Promise<boolean>`, `community.joinOfficialGroupAsync(): Promise<void>` | Independent eligible Settings action; requires a linked official game group. |
| Exit the game | `quit(): void` | Explicit Settings action after accepted saves are flushed. The game and Settings remain inert while quitting; failed saves keep the game open. No browser-window-close substitute. |

The [native invite contract](https://developers.facebook.com/documentation/games/sdk-reference/v8.0#inviteasync)
allows dialog cancellation to resolve successfully, so completion is not a
delivery receipt. The [shortcut contract](https://developers.facebook.com/documentation/games/sdk-reference/v8.0#createshortcutasync)
limits creation to one request per SDK session. The [community contract](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/community)
provides eligibility checks and native overlays, with `PAGE_NOT_LINKED` and
`GROUP_NOT_LINKED` failures for missing associations. These cases must remain
unavailable actions rather than synthetic success.

## APIs without a current game use

| API family | Reason for leaving it uncalled |
| --- | --- |
| `player.getName`, `player.getPhoto` | Removed in v8 Zero Permissions. Keep profile information inside Meta overlays. |
| `globalLeaderboards` | Deprecated in the current Zero Permissions reference; official boards already have a server-authoritative implementation. |
| Recurring subscriptions | [Instant Games IAP](https://developers.facebook.com/documentation/games/monetize/in-app-purchases) currently excludes subscriptions. Existing trusted subscription entitlement still suppresses Facebook ads. |
| `player.getConnectedPlayersAsync`, `context.getPlayersAsync` | No separate friend directory is needed for the native invite/context chooser. Connected-player objects expose IDs, not profile data. A future directory would require Meta-owned overlays. |
| `context.createAsync`, `context.switchAsync` | No direct-target creation/switch UI exists. Existing chooser, matchmaking and entry flows already own context selection. |
| `tournament.joinAsync`, `tournament.getTournamentsAsync` | The game uses an official daily tournament and native invitation entry, rather than a separate Meta tournament catalogue. |
| `postSessionScore`, `postSessionScoreAsync` | Classic completion has no canonical comparable session score. Do not invent one from coins, lifetime level, or variable-length session wins. Tournament scoring already uses authoritative adjusted times. |
| `player.canSubscribeBotAsync`, `player.isSubscribedBotAsync`, `player.subscribeBotAsync`, `player.createNEZPNotificationContentAsync` | A second bot subscription/content route would duplicate the existing notification manager and consent model. |
| `getASIDAsync`, `getSignedASIDAsync`, associated-app identity | Existing nonce-bound player identity is sufficient; no cross-app account-linking feature is requested. |
| `openExternalLinkAsync` | The current About UI has a support email and bundled licenses, not an approved absolute HTTP(S) destination requiring a native opener. |
| `performHapticFeedbackAsync` | No player haptic preference or feedback controller currently exists. Calling it merely to exercise an API would introduce unsolicited vibration. |
| `getDisplayMode`, `onDisplayModeChange` | Read-only desktop presentation signals; responsive layout already adapts to its viewport. They do not provide fullscreen control. |
| `getPlatform`, `getSDKVersion`, `getEntryPointAsync`, `setSessionData` | No additional product behavior or necessary diagnostic depends on them. Existing entry data handles routing; no extra identity/gameplay metadata is sent. |
| `switchGameAsync` | No second game destination owned by the same business is configured. |
| `room.getCurrentMatchAsync` | No Messenger Rooms co-play session exists in this game's multiplayer model. |
| Banner ads | Rewarded continuation and natural-break interstitials cover the requested ad surfaces; no banner placement or reserved UI is configured. |
| Favorites/bookmarks | No supported favorites API was found in the current v8 and Zero Permissions references. Home-screen shortcuts use the documented capability. |

## Platform configuration and acceptance

Community actions require real official page/group associations. The [Pages and
Groups guide](https://developers.facebook.com/documentation/games/retain/pages-and-groups)
describes linking the app page in App Dashboard Settings and linking the group to
the game page. This audit does not claim those associations are configured.
Capability/eligibility checks keep unavailable actions out of the game.

Ads still require approved placements and inventory. Purchases require the
existing payment configuration/webhook gate, and context updates require the
declared template. Native dialogs, cancellation, one-shot shortcut behavior,
community associations and account/lifecycle retirement require acceptance on
actual supported Meta hosts. SDK declarations, source inspection and local
builds cannot establish that acceptance.

## Local verification and branch state

- `pnpm build:facebook` passed TypeScript compilation, platform-layout and target
  boundaries, commerce activation, all 16 locales, third-party notices, Vite and
  the Facebook artifact audit. The artifact contains 418 files, 4.44 MB total and
  0.67 MB initial resources, with no Jest client/native module/secret leakage.
- `git diff --check` passed. Independent source review covered native payloads,
  referral attribution failure, SDK dialog exclusion, shortcut attempt limits,
  pending saves and account retirement. Focused regression cases were added but
  not executed, following the repository's explicit-test-request policy.
- `origin/facebook` and `origin/web` were refreshed before committing. The
  Facebook branch already contained all remote web commits.
- All new controls use translated labels in every supported locale. The unused
  referral-reward invitation label was removed from all locales.
- No backend integration was changed, no invitation was sent to a real person,
  and no game upload, backend deployment, publication or Meta configuration
  change occurred in this unit. Community page/group actions still require the
  corresponding Meta association and host eligibility.
