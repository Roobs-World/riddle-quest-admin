# Remaining Facebook API contracts — 28 November 2026

**No complete client-only integration for the six remaining gap entries is justified by the currently verified product and authority contracts.** This is a bounded research result, not completion of the Facebook submission. Testing 24’s multiplayer revision and the owner’s tournament removal remain intact. No application code, settings, backend, manager, browser session, release assignment or account was changed.

Research used Meta’s documentation-discovery connector and freshly retrieved official Markdown. Web-tool page opens failed, so the public pages were read directly over HTTPS with `Accept: text/markdown`; each returned HTTP 200. Sources and private-content digests are recorded below. Local inspection was read-only, with no tests or builds.

## Six remaining entries

| Entry | Verified contract and consequence |
| --- | --- |
| `FBInstant.switchGameAsync` | The destination must be a **different Instant Game** owned by the same business. Success loads that game. App `1748953042991569` alone supplies no destination; a dormant method or switch back to this same app does not complete cross-promotion. [Root v8 reference](https://developers.facebook.com/documentation/games/sdk-reference?no_redirect=true#switchgameasync) |
| `player.getASIDAsync` | Returns an optional legacy ASID for eligible migrated Canvas players or previous game-terms acceptors. Sharing one app ID with a native version can produce the same ASID; a second app ID is **not universally required**. Eligibility and an actual prior account remain unverified. [Player v8 reference](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/player#getasidasync) |
| `player.getSignedASIDAsync` | The same eligibility applies. Signature checking uses the app secret and belongs on a server. A client-only call cannot authorize a merge. [Player v8 reference](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/player#signedasid) |
| `player.getAssociatedAppsASIDAsync` | The current v8 changelog and current management guide still document this unsigned associated-app lookup. It returns linked app/ASID mappings; no association/player history can yield an empty result. A meaningful workflow needs a real linked off-platform version and trusted account lookup. [Management guide](https://developers.facebook.com/documentation/games/build/zero-permissions/onboarding-and-migration/cross-play-management) |
| `player.getSignedAssociatedAppsASIDAsync` | Returns signed identities for pre-approved linked apps; the reference explicitly assigns verification to the server. No applicable linked app or existing linking consumer is established for this task. [Player v8 reference](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/player#getsignedassociatedappsasidasync) |
| `player.createNEZPNotificationContentAsync` | Produces a stored-content ID for later A2U delivery. Its recipient IDs must belong to the current game context. Calling it alone is not a notification workflow, and no current manager consumer was found. [Player v8 reference](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/player#createnezpnotificationcontentasync) |

The current [cross-play management guide](https://developers.facebook.com/documentation/games/build/zero-permissions/onboarding-and-migration/cross-play-management) requires eligible apps under the same business, administrator/developer access and an attestation that they are the same game. It says associations cannot be removed or changed through that interface. Do not submit this attestation from an assumed app identity. The [migration guide](https://developers.facebook.com/documentation/games/build/zero-permissions/onboarding-and-migration/player-identification-post-migration) describes backend matching and the native-side `ids_for_business` lookup; it does not establish a browser-only merge authority.

Search also returns an [archived Cross Play framework](https://developers.facebook.com/documentation/games/archive/cross-play). That historical framework’s archive notice must **not** be used to declare current v8 associated-ASID operations withdrawn: the current root changelog explicitly links the current management guide. No gap entry was reclassified as deprecated in this research.

## Stored-content boundary: a narrower, documented gate

The [current A2U contract](https://developers.facebook.com/documentation/games/retain/notifications/a2u-api) supplies meaningful provider constraints: a single-card target must be among the SDK creation recipients; carousel content must belong to the calling app and have been created for its target player. The manager sends through the app-authenticated notifications edge. Therefore, saying Meta has no documented app/recipient binding requirement is too broad.

Meta documents client-side SDK creation followed by server-side A2U consumption; it does not require a signed content receipt for that supported flow. Its app/recipient checks do **not** establish that a browser-returned ID was rendered from the manager’s approved title, subtitle, assets and generation. The same guide says stored-content cards use the title/subtitle supplied during SDK creation and are not rechecked at send time. No content-inspection endpoint, signed content receipt or manager-plan attestation was found in the reviewed A2U/player contracts; this is a scoped absence, not proof that no private provider facility exists.

The owner protects Firebase, its configuration and provider server modules, not the separate notification manager. The [later boundary review](facebook-nezp-content-boundary-2026-11-28.md) distinguishes this scope from the implementation gaps: the manager has no player-authenticated stored-content plan/receipt flow, and the protected Firebase dispatcher accepts only authored plain-message content. Direct manager-to-Meta delivery would also need to preserve the dispatcher's fresh consent, revision and account-deletion checks. No complete design meeting those existing invariants was established; creating disposable content without a consumer would not close the integration gap.

This follows the repository’s [notification ownership](../../common/notifications/README.md): the manager owns content, scheduling and sends. Searches of the current Facebook client, shared source, Firebase source and notification manager found no caller or consumer for these six operations. No provider credential was read or exposed.

## Desktop matchmaking is not a guaranteed cancellation-only probe

The current [v8 `matchPlayerAsync` contract](https://developers.facebook.com/documentation/games/sdk-reference?no_redirect=true#matchplayerasync) says a successful operation creates a Messenger group with matched players. Its booleans select immediate context switching and offline/asynchronous matching. The API lists `USER_INPUT` among errors, but does not promise a cancellable prompt before any group creation.

The actual [bootstrap adapter](../../../platforms/web/facebook/src/FacebookPlatformBootstrap.ts) calls `matchPlayerAsync(tag, true, true)` after the advertised eligibility check. Consequently, clicking **Find opponent** may enroll or match the player and switch context; it cannot be treated as a harmless chooser-open/cancel check. The existing **Play with friends** path calls `context.chooseAsync` separately. Under the current single-account/no-social-send check, retain the real friend-chooser cancellation evidence and defer actual matching until the interaction scope and consenting participants are established. No API behavior was changed to fabricate a safer test outcome.

## Evidence boundaries

Current source inspected at `21af56266af3c567638bc29a5f9f6a516e2a6137` on `facebook`; this is a documentation head over uploaded source `bcb9898e85988c5dde49a1eb3e043c6403869a94`. The protected Firebase baseline was not edited. No host API invocation, association, notification generation/send, match, approval request or deployment occurred.

Fresh source snapshots are private research artifacts under `/tmp/rq-remaining-sdk-*.txt`. The digests bind this research to what was read; they are not hosted-game acceptance evidence.

| Official source | SHA-256 of fetched Markdown |
| --- | --- |
| [root](https://developers.facebook.com/documentation/games/sdk-reference?no_redirect=true) | `11bb38ea997d44c632243fee332228b005068a022dfa886c45f57e619fc6ce22` |
| [player](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/player) | `093e59f38e599123f629cfeb1ea765782a953f6ede57d0df47bfe515ad41c3b0` |
| [cross-play-management](https://developers.facebook.com/documentation/games/build/zero-permissions/onboarding-and-migration/cross-play-management) | `31d61d54b2b6e14d4740bdc9654e17587452f1f36d5355d0acc393eba7830448` |
| [migration](https://developers.facebook.com/documentation/games/build/zero-permissions/onboarding-and-migration/player-identification-post-migration) | `b7f03d6f9f12bb91b414323223552e3e71c086a26071790cac9b8e9a4fe97bfa` |
| [a2u](https://developers.facebook.com/documentation/games/retain/notifications/a2u-api) | `ad2ed5afa5b51260cbfe98c99225027d126fd8b9364db59d95d6b82ba30f2765` |
| [cross-play](https://developers.facebook.com/documentation/games/archive/cross-play) | `52393cf7ed019e31d08f929c120ae75ff285dea4b994598b56a37675254174ec` |

## Firefox access and off-platform identity follow-up — 28 November

The 13:05–13:10 UTC Firefox check inspected the signed-in account's existing app screens without changing a configuration or association:

- At 13:05:45.499, the game route displayed an unsupported-browser message. No game iframe was present; only the `maw_proxy_page` frame remained. Sign-in did not establish Firefox gameplay support.
- At 13:07:18.448, searching app names for **Riddle** returned only the current app, `1748953042991569`. The receipt's `scopeLabels` array is empty, so this is a scoped search result, not proof that every app in the account was searched or that a separate app does not exist.
- Cross-Play showed **Not Linked** at 13:07:52.248. The initial **Link** button opened the same-game/irreversibility warning at 13:09:44.891. **Continue was never clicked**, no target was selected, and **Cancel** dismissed the warning. At 13:10:27.357, the receipt still showed Not Linked and no open dialog.
- The two owned Firefox tabs were closed at 13:10:27, preserving the original tab. No app association, upload, source change or review submission occurred.

The inspected Android configuration identifies package `com.roobsworld.riddlequest` in [Gradle](../../../platforms/native/android/android/app/build.gradle); the [Android operations guide](../../android/android-google-play-operations.md) confirms that package and Firebase provisioning. Android manifests, Gradle settings, string resources, dependencies, hosted example configuration and Android documentation supplied no explicit Meta app ID, Facebook Login configuration or ASID association. The `com.facebook.react` references are React Native dependencies. The [Android plan](../../android/android-parity-plan.md) describes optional Google linking with Firebase UID preservation; its Firebase registration ID is not a Meta app ID. This bounded repository search establishes neither the existence nor the absence of a separate Meta app, and the current Facebook app ID is not evidence of one.

Private receipts remain under `/home/craig-beswetherick/.firefox-devtools-mcp/output/`; their hashes bind the observations without publishing profile or contact data:

| Receipt | SHA-256 |
| --- | --- |
| `rq-firefox-game-access-final-2026-11-28.json` | `f9b200d1c692aac892b9e2570a580b17e38f8a702f4c6c9f8733d88b00921053` |
| `rq-firefox-app-search-2026-11-28.json` | `82062c65028e0709d6118130da59905ce6bc7058ae126dd172ff1b6673d11ddf` |
| `rq-firefox-cross-play-2026-11-28.json` | `189a7632bd1fc02080b3fbf4323a7f1e91794954c8c6215fa81e9d9cf79495fb` |
| `rq-firefox-cross-play-warning-2026-11-28.json` | `a2307507260e1a19673631d51725a10f54efb3e2d52bf852568851531b5a02d1` |
| `rq-firefox-cross-play-cancelled-2026-11-28.json` | `d060b94043c4970e0e1010997444eef5f18f0b7007aa901f5835d95c783e97c3` |
