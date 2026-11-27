# Generic Facebook profile overlays — 27 November 2026

The Facebook profile adapter now retains the existing convenience picture/name pair when both APIs are advertised and callable. Otherwise it selects one supported generic factory in this order:

1. `overlayViews.createOverlayViewAsync`
2. `overlayViews.createOverlayViewWithXMLStringAsync`
3. `overlayViews.createOverlayView`
4. `overlayViews.createOverlayViewWithXMLString`

These are alternative renderers of the same current-player profile. They do not create four copies. The shared `OverlayCapability.renderPlayer` interface, verified audience gates and existing Activity/Tournaments mounts are unchanged.

## Source and provider contract

- [Profile adapter](../../../platforms/web/facebook/src/FacebookOverlayCapability.ts)
- [Factory selection and callback bridge](../../../platforms/web/facebook/src/overlays/FacebookOverlayFactories.ts)
- [Scoped custom-event dispatcher](../../../platforms/web/facebook/src/overlays/FacebookOverlayEvents.ts)
- [Canonical XML layouts](../../../platforms/web/facebook/src/overlays/FacebookProfileOverlayLayout.ts)
- [Facebook artifact plugin](../../../platforms/web/facebook/tooling/facebookArtifactPlugin.ts)
- [Current Meta overlay reference](https://developers.facebook.com/documentation/games/sdk-reference/v8.0/overlayViews)
- [Meta migration guide](https://developers.facebook.com/documentation/games/build/zero-permissions/onboarding-and-migration/migrating-to-nezp)

The callback factories return an unattached handle immediately. The adapter takes ownership, styles and attaches its frame, then awaits initialization. Promise factories attach the frame themselves. Synchronous callbacks, failed attachment, initialization errors and late results remain observed.

The layouts contain `{{FBInstant.player.name}}` and `{{FBInstant.player.photo}}` bindings for Meta to resolve. Game code receives no rendered name or photo. Initial data is empty. A fixed `rq_profile_photo_error` event carries no player identifier. The single custom-handler slot is shared by an SDK-scoped dispatcher; each mounted profile accepts only its own overlay ID. The optional overlay inventory recovers handles attached beneath the exact owned surface, including failed or pending initialization. Other surfaces are never swept.

An owned photo error replaces that profile with a Meta-rendered name-only layout once. Repeated, foreign, retired and stale-account events cannot create another fallback. Native `destroyAsync()` is used directly so a stalled dismissal cannot prevent destruction; older handles fall back to dismissal. Disposal remains idempotent and original in-flight operations keep observers after cancellation.

The canonical strings also produce `facebook-overlays/profile.xml` and `facebook-overlays/profile-name.xml` through the Facebook-only artifact plugin. The plugin serves those paths during local Vite development. No shared public assets or other target SDK paths were added. Frames remain passive (`pointer-events:none`, `tabIndex=-1`) and receive the existing translated `Profile.TITLE`; their Meta-owned contents are not marked hidden from assistive technology. The generic card reserves 64px, with a 48px photo and bounded name text.

## Verification recorded for this implementation

Command:

```sh
pnpm exec jest --runInBand --runTestsByPath \
  platforms/web/facebook/src/__tests__/FacebookOverlayCapability.test.ts \
  platforms/web/facebook/src/__tests__/FacebookGenericOverlays.test.ts
```

Result: **2 suites passed, 32 tests passed** (13 existing lifecycle cases and 19 generic-factory cases).

The generic cases exercise each factory alone, convenience preference, missing callable methods, attachment before callback readiness, synchronous initialization, attachment failure, callback failure followed by late success, cancellation, late asynchronous handles, inventory-scoped cleanup, account changes, one-time photo fallback, optional management API gating and legacy dismissal. Existing cleanup tests now assert direct destruction and retain older dismissal-only compatibility coverage.

The tests use a local DOM fixture and SDK doubles. They establish controller behavior, not Meta XML rendering or hosted acceptance. The [combined verification](facebook-expanded-api-final-verification-2026-11-27.md) subsequently passed the production artifact build and conditional browser journey, verified both XML files and inspected mobile fixture screenshots. Real-host rendering and accessibility acceptance remain open. No upload, activation, publication or review submission occurred.
