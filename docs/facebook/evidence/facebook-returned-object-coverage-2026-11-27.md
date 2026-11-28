# Returned-object coverage — 27 November 2026

## Tournament and LiveMatch

A read-only source audit at `70cc0d0c7eb3f15edd7aecd9e1ae9df50363bc33` checked the SDK declaration inventory against real consumers and UI routes. All six declared Tournament getters and both LiveMatch getters have meaningful reachable uses. No source-only addition is warranted for these methods.

| Returned methods | Reachable use |
| --- | --- |
| Tournament `getID`, `getEndTime`, `getTitle` | [FacebookNativeSocial](../../../platforms/web/facebook/src/social/FacebookNativeSocial.ts) validates identifiers and expiry, deduplicates/orders active listings, and sanitizes titles for display. |
| Tournament `getPayload`, `getTournamentType`, `getContextID` | The same adapter rereads a joined tournament and validates payload, public type, selected ID, resulting context and expiry before routing to the official locale board. |
| Private Tournament getters | [facebookPrivateTournament](../../../platforms/web/facebook/src/engagement/facebookPrivateTournament.ts) validates private type, matching points payload, locale, IDs and expiration before admitting compatible private scoring. |
| LiveMatch `getID`, `getContextID` | [FacebookNativeSocial](../../../platforms/web/facebook/src/social/FacebookNativeSocial.ts) validates both during discovery, then rereads and compares both before switching context. |

[FacebookNativeSocialPanel](../../../platforms/web/facebook/src/social/FacebookNativeSocialPanel.tsx) exposes eligible Room and tournament joins. [FacebookRaceEntry](../../../platforms/web/facebook/src/FacebookRaceEntry.tsx) routes validated tournament joins to the matching official board.

This establishes source reachability, not accepted native joins. A real eligible Messenger Room, populated eligible tournament, consenting test participants and private-tournament allowlist/group/scoring prerequisites remain necessary. Empty listings do not prove these success paths. No files, services, accounts or provider settings were changed by the audit, and no build or tests were run for it.

## Remaining returned objects

A follow-up read-only source audit at `742e71ed3664e5ba5e185eac78f8be30bd293e9b` checked the other declared returned-object methods. These findings establish source consumers, not additional hosted execution or approval.

| Object | Current consumer and limits |
| --- | --- |
| SignedPlayerInfo | The credential exchange consumes `getPlayerID` and `getSignature`; authentication passes the resulting signed credentials through the existing verification flow. |
| ConnectedPlayer / ContextPlayer | The social adapter validates and deduplicates `getID` values for counts. Removed raw name/photo methods are not integration gaps. |
| AdInstance | [FacebookAdsCapability](../../../platforms/web/facebook/src/FacebookAdsCapability.ts) consumes `getPlacementID`, `loadAsync` and `showAsync`. The audited version-15 check required an exact match before loading and again before display. The [28 November native diagnosis and correction](facebook-android-ad-diagnosis-2026-11-28.md) subsequently found Android can omit the metadata: corrected source accepts `undefined` on the requested factory handle while retaining both getter calls and rejection of malformed/mismatched values. Corrected native playback remains pending. |
| OverlayView | [FacebookOverlayFactories](../../../platforms/web/facebook/src/overlays/FacebookOverlayFactories.ts) attaches and positions `getIFrameElement`. [FacebookOverlayCapability](../../../platforms/web/facebook/src/FacebookOverlayCapability.ts) uses owned IDs to match photo-error events, awaits `showAsync`, and retires owned frames with `destroyAsync`, falling back to `dismissAsync`. Dismissal remains a documented API; the fallback choice does not imply deprecation. |
| SignedASID / SignedAssociatedAppASID | No local consumer. A genuine eligible association or migration and trusted server verification remain prerequisites. Browser-returned identifiers cannot authorize account merging. |

## Optional OverlayView methods

The current [official OverlayView reference](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/overlayViews#overlayview), read directly on 27 November 2026 and visibly updated 27 October 2026, documents four additional, non-deprecated methods. All four remain undeclared and unused in this client; they must not be counted as integrated.

| Method | Documented contract | Current disposition |
| --- | --- | --- |
| `getStatus(): ShieldOverlayLifecycleState` | Synchronous lifecycle snapshot, including loading, parsed, ready, rendered, dismissed/destroyed, update-ready and error states. | Existing initialization promises/readiness callbacks, rendering promises and owned teardown cover the current flow. No missed failure requiring status polling was demonstrated. |
| `getInitialData(): ?Object` | Creation data, or null when omitted. It is not documented as a snapshot of subsequent updates. | Factories pass `{}`; fixed provider-bound profile templates have no game-owned creation data to recover. |
| `getErrors(): Array<OverlayViewError>` | Lifecycle error entries contain `caller: string` and `error: mixed`. Notification, clearing, bounds and a fixed error-code shape are unspecified. | Promise/callback failures and the photo-error event already drive the implemented recovery. This could support future diagnostics, but no missing diagnostic consumer was demonstrated. |
| `updateAsync(updatedData: Object): Promise<void>` | Updates template data, resolving on completion or rejecting with `APIError`; subsequent `showAsync()` is required. | Current templates have no changing game-owned data. No XML replacement, CSS-file or outer-frame geometry parameter is documented. |

The reference explicitly allows attaching and positioning the element returned by [`getIFrameElement`](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/overlayViews#getiframeelement). That supports the current frame styling; `updateAsync` is not a documented replacement for it. [FacebookProfileOverlayLayout](../../../platforms/web/facebook/src/overlays/FacebookProfileOverlayLayout.ts) contains fixed provider-bound name/photo templates. Adding data updates or polling solely to increase the method count would not establish a useful integration.

No source change, test, build, account operation or provider setting change was made for this follow-up. Supported-host native profile rendering and lifecycle acceptance remain separate outstanding checks.
