# Android rewarded-ad diagnosis — 28 November 2026

**The observed mobile request was rejected on undefined placement metadata before ad loading. The local correction is verified; corrected native playback remains pending.** This continues diagnosis of the previously verified Riddle Quest version **16** phone candidate, bundle `40447241201556884`, source `13cfd1cb522b17be775227c07d56c209ec283ad4`. No new archive was uploaded. The [version 16 host evidence](facebook-android-host-version-16-2026-11-28.md) records the exact device/bundle verification and earlier uninstrumented outcomes; the [upload receipt](facebook-testing-version-16-2026-11-28.json) records artifact identity.

This note separates later temporary instrumentation from those earlier native observations. It is not successful rewarded-ad acceptance or evidence that the new foreground gate caused the failure.

## UI checks before instrumentation

During an **8.8-second** uninstrumented continuation check, two observations found the loss-screen ad button enabled, without a recognized native ad. This provides a visible failure/recovery signal, but no SDK error code or failed stage.

Two later harness attempts are excluded from uninterrupted-journey evidence:

- One UIAutomator operation exited **137**; its result was inconclusive.
- Another failed to obtain an idle UI before the intended click; it does not establish an ad request.

These harness failures are not attributed to the game or Meta ad service.

## Temporary observer 1

Initial console-script entries were autocorrected or truncated while SwiftKey was active. No observer was installed until an encoded `Function` command was entered in **80-character chunks**, and its exact base64 text was validated against a fresh rendered UI read. Installation was then confirmed.

At **00:48:05 UTC**, the actual visible loss-screen **Watch an ad** action was tapped. The UI showed **Loading**, then **Service temporarily unavailable. Please try again.** with **1,035 coins** unchanged. After the attempt settled, IGDebug was reopened and the observer returned only these fixed stage labels:

```text
create.call
create.resolved
load.unwrappable
show.unwrappable
```

This observer recorded factory invocation and resolution. Its own-method-only wrapping could not observe the inherited `loadAsync` and `showAsync` methods. The `unwrappable` labels describe an instrumentation limitation: **they do not establish that loading or showing was never called**, and they do not identify a provider rejection or lifecycle suppression.

The stop operation reported restoration. Subsequent `typeof` checks for the probe and scratch bindings returned `undefined`.

## Temporary observer 2: long-session result

The inherited-instance-shadow observer's exact console input was verified after a UI-idle retry, and installation was confirmed. At **00:54:15 UTC**, the actual visible **Watch an ad** action was tapped. The UI showed **Loading**, then returned to the enabled action with the same generic service-unavailable message and **1,035 coins** unchanged.

Reading the settled observer produced:

```text
create.wrapped:own
create.call
create.rejected:ADS_TOO_MANY_INSTANCES
```

This identifies a factory rejection in this later long-session attempt, so there was no returned ad handle for this attempt to instrument. It does **not** identify the first-request failure: observer 1 had already recorded `create.resolved`. No conclusion about the earlier load/show stages follows from this later rejection.

The stop operation returned restoration, and `typeof` checks for the probe and scratch bindings returned `undefined`. The host **X** then closed the game. No temporary runtime patch was retained through quit. The next check launched a fresh session through the app deep link.

## Temporary observer 2: fresh-session first request

Fresh rendered SDK Info confirmed version **16** and exact path `/instant-bundle/2143220529953108/40447241201556884/index.html`; banner load was advertised. The console was blank before injection, and observer installation was confirmed. **Let's Play** restored the kettle loss state and **1,035 coins**.

At **00:59:17 UTC**, the first actual UI rewarded request in this fresh session showed **Loading**, then the generic service-unavailable error and enabled action. No native ad was visible, and 1,035 coins remained unchanged. The settled trace was:

```text
create.wrapped:own
create.call
create.resolved
load.wrapped:inherited
show.wrapped:inherited
```

There was no `load.call`, `show.call`, `unwrappable` or `unobservable` record. This instrumented first request resolved creation and successfully installed inherited-method observers, narrowing the failure to the application's checks between creation and loading. It is not evidence of an SDK `loadAsync` rejection. This trace alone did not identify placement validation, foreground state or another condition as the cause; observer 3 below narrowed it further.

The stop operation confirmed restoration, and `typeof` checks for the probe and scratch bindings returned `undefined`. No runtime observer was retained after this check.

## Temporary observer 3: placement metadata

The exact input was verified and observer installation confirmed before the real UI rewarded request at **01:07:08 UTC**. The normal action showed **Loading**, then the generic service-unavailable error; **1,035 coins** remained unchanged. The recorded stages were:

```text
create.wrapped:own
visibility.visible
create.call
create.resolved
create.resolved-type:object
placement.wrapped:inherited
load.wrapped:inherited
show.wrapped:inherited
placement.call
placement.non-string:undefined
```

The native factory returned an object, and the actual inherited `getPlacementID` getter was called and returned `undefined`. No subsequent load/show call or hidden-visibility event was recorded. The [version-16 `assertPlacement` check](https://github.com/Grindhead/riddle-quest/blob/13cfd1cb522b17be775227c07d56c209ec283ad4/platforms/web/facebook/src/FacebookAdsCapability.ts) requires the getter's value to equal the configured placement string, so it rejects this value before loading. This identifies the immediate client failure in this attempt; it is not an ad no-fill result or evidence of a missing test-device setting. It does not establish why the native metadata was undefined or exclude additional failures after that check is addressed.

Observer 3 cleanup returned `restored`; the probe and scratch bindings were both `undefined`. The game was then quit and relaunched. A read-only console check confirmed the exact version-16 bundle path and absent probe binding. No runtime observer remains. The compatibility correction below is local; no corrected native playback is claimed yet.

## Public SDK implementation evidence

A read-only download of Meta's [public FBInstant 8.0 SDK](https://connect.facebook.net/en_US/fbinstant.8.0.js) at **2026-11-28T01:07:11.660531+00:00** returned HTTP 200, **616,490 bytes**, SHA-256 `2bb6a962de7c0084432372ee7ac2d8cd89e96bf1be73748694c27c2948c80524`.

In its `fbinstant/releases/8.0/ads.8.0` module, the rewarded factory validates and forwards the supplied placement ID to the native host, then wraps the returned data. The prototype placement getter returns that data's `placementID` field without normalization. This supports interpreting the getter observation; the downloaded source alone does not establish the native response representation. It is a public-artifact inspection, not an independent hash of the phone's loaded SDK. No vendor source is copied here.

## Instrumentation limits

The wrapper forwarded the same arguments and receiver, returned the original promise and propagated synchronous throws. It also attached a rejection handler, which changes handled-rejection bookkeeping, and changed method identity while adding promise-reaction microtasks. These effects prevent treating this instrumented attempt as untouched native acceptance.

No SDK factory was called directly by the probe, no eligibility gate was forced, and no reward was synthesized or granted. Only fixed stage names and the bounded SDK error code were retained; no raw player IDs, error payloads, private launch parameters or personal images are included. No screenshots were committed.

The [API inventory](../facebook-api-research-2026-11-27.md) and [returned-object audit](facebook-returned-object-coverage-2026-11-27.md) distinguish ad creation from `AdInstance.getPlacementID`, `loadAsync` and `showAsync`. The current stage trace does not cover that complete lifecycle.

## Separate role and testing-configuration observation

A read-only Meta connector projection at **2026-11-28T00:49:50.818Z** reported the current connected account's role as **admin** for app `1748953042991569`. It does **not** prove that the phone uses that same account.

The available Meta connector tools did not expose the Monetisation Manager **Integration → Testing** configuration for property `957348766757902`, including its testing flag, device-format selections or Android Advertising IDs. That configuration was not verified by this query. No missing test-device setting is inferred as the cause of the rewarded failure.

## Observer validation and preserved boundaries

The inherited-instance-shadow probe's 2,491-byte source has SHA-256 `5abcb84cf6223747dcc99cdf1196834af5fc0b4755d35764e1acdeaf397717a5`. Eight local Node fixtures passed for original receivers/arguments, identical returned promises and rejection/throw objects, one-shot records, unchanged prototypes, exact restoration/deletion, late settlement after cleanup, preservation of another owner's replacement, and refusal of accessor/nonwritable/nonextensible handles. These are temporary observer checks, not game acceptance. Both its long-session and fresh-session first-request results are recorded above.

Observer 3 covers synchronous `getPlacementID` and passive document visibility. Its **3,114-byte** source has SHA-256 `c600230eb2a32dcb2e565f5e33134e6c1eb8cd6aa432fb47e2ccf027a88e80fe`. Ten initial preservation fixtures and eight additional non-string-type fixtures passed. Its native trace and confirmed cleanup are recorded above. Those fixtures validate the temporary observer, not the game correction or native ad completion.

Firebase, provider-server source/configuration and backend deployments remain unchanged. This diagnostic unit made no new Facebook upload, Production promotion, review submission, purchase or social send. Native rewarded completion remains open; the reason for the undefined native metadata is not established.

## Client correction and local verification

The placement check still requires a callable getter on the handle returned by the requested SDK factory. It now accepts the exact requested string or the observed `undefined` metadata. Null, numbers, empty/padded/mismatched strings, missing/non-callable getters and exceptions remain rejected. The getter runs before loading and again before showing; ownership, foreground and fresh entitlement checks remain intact. No private SDK field, fabricated placement, direct factory probe or backend change was introduced.

The inherited-method regression reproduced the defect for both formats: the original suite had **4 failures and 40 passes in 0.241 seconds**. After the correction, all **44 tests passed in 0.205 seconds**, including rejection when initially omitted metadata changes to a different reported placement before display. Another **64 tests across five related suites passed in 0.285 seconds**, and the **13 banner cases passed in 0.174 seconds**. An initially mistyped banner-suite path did not run that suite; the corrected path was run separately without repeating the five passing suites. The shared TypeScript check passed.

A focused real-entry browser fixture passed in **6.947 seconds**: the native-style inherited getter returned `undefined`, the factory received the expected configured placement, the player used the actual loss-screen action, and one native-display fixture completion led to exactly one authenticated continuation claim with unchanged coins and restored input. SDK/HTTP fixtures are separate from native acceptance. The complete existing browser journey plus the new regression passed **1 test / 1 suite in 43.631 seconds**, with a successful isolated Facebook build/artifact audit of 420 runtime files. Two historical screenshots rewritten by that harness were restored to their original bytes. A corrected Testing upload and native playback remain pending.

## Standards review

No documented standards violations were found in the current unit against `f071896be0ae38ded3c90dab35cbe3cc37c8d9ec`. Source and fixtures stay within the Facebook platform root. The fixture exercises the real loss UI, waits for SDK completion before the authoritative grant request, checks unchanged coins and restored input, and removes its route handler. The small fixture duplication does not justify another abstraction. No backend edits or foreign provider integration were found.

## Spec review

No findings. The fallback accepts exactly the observed omitted metadata or the configured string while retaining getter calls before loading/display and rejection of other invalid values. Each handle still comes directly from the configured format-specific SDK factory. Undefined metadata removes an independent placement cross-check; it does not substitute another handle or format. Ownership, foreground, fresh entitlement and successful SDK display completion remain required. Server-authoritative, idempotent continuation behavior is unchanged. Corrected native playback remains pending.

Review result: **Standards: 0 findings; Spec: 0 findings.**
