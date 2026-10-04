# Independent Facebook context capability — 3 October 2026

The Facebook context chooser and its existing boards now remain available when a host supports `context.chooseAsync` but lacks native matchmaking. Unsupported `matchPlayerAsync` remains explicitly unavailable and is never called. Jest and Reddit use their existing adapters.

## Reproduced gap and change

The previous bootstrap required both context selection and native matchmaking before exposing `nativeSocial`. This hid a supported chooser, prevented the context coordinator from being composed and removed context boards when matchmaking was absent, unadvertised or advertised under the wrong namespace. It also trusted an advertised chooser name without checking that its method was callable.

Four new cases went red through the actual bootstrap: three supported-chooser combinations were suppressed, and an advertised but missing chooser was exposed. Nineteen existing cases passed in that baseline.

The bootstrap now requires an advertised, callable `context.chooseAsync` for the context capability. Its native matching method independently checks the exact root `matchPlayerAsync` advertisement and callable implementation before entering the existing dialog guard. The original safe tag validation, SDK context validation, 13+ audience restriction, authenticated matchmaking rollout, failure classification and shared provider-dialog guard remain enforced. No provider-neutral interface, purchase/identity/referral authority, backend endpoint or grant changed. No new SDK or visible text was added.

The authenticated Meta documentation connector returned the current [Zero Permissions API reference](https://developers.facebook.com/documentation/games/build/zero-permissions/api-reference), which directs clients to use `getSupportedAPIs()` for operation availability. Direct web fetches of the v8 module pages were unavailable; that limitation is retained in the documentation summary. The implementation uses the game's existing FBInstant v8 API boundary.

## Verification

Evidence is in `artifacts/facebook-context-capabilities-2026-10-03/`.

- The four affected adapter/context/policy suites pass **42 tests**. They retain age/configuration failure behavior, strict metadata and tag validation, and cancellation/failure/overlap handling alongside the new capability combinations.
- The full portal run passes **2,338 tests in 273 suites**, with 118 browser tests skipped in 15 suites. Types, TSDoc and maintainable-file size checks pass.
- Two separate fresh Facebook browser builds pass: chooser-only and full SDK. A runtime assertion verifies the exact SDK inventory and method availability in each variant. The actual entry composes its coordinator and context board, switches membership, shows new standings, suppresses repeated dialogs and retains profile-overlay cleanup. Both journeys also retain lifecycle, live race/rematch, tournament, notifications and rewarded-continue coverage.
- The injected Reddit journey and **six selected Jest authenticated browser regressions** pass against owned build directories. Sixty-eight unselected Jest cases remain skipped; full Jest browser acceptance is not claimed.
- All **six isolated builds and explicit output-directory audits pass**: Jest, Facebook, Reddit, YouTube, Netflix and Yahoo. The artifact audits retain SDK isolation, Facebook-only ads, Reddit same-origin traffic and self-contained YouTube/candidate boundaries. Browser screenshots for both Facebook variants were inspected.

The change makes existing supported Facebook features available; it does not implement selected-friend matching in the global queue, enable financial or notification delivery contracts, prove real Meta role/device behavior, or establish deployment equivalence. Those review gates remain open. The read-only authenticated Meta review result retained in the preceding evidence still reports `UNSUBMITTED`.

This checkout changed concurrently. The manifest records unconfirmed atomic source/build provenance, upload ineligible, no deployment by this chat and no provider setting mutation. Browser verification uses injected Chromium/SDK harnesses. Firefox remains unavailable to the tools exposed in this session.

The subsequent [capture check](facebook-context-capture-check-2026-10-03.md) corrects the initial incomplete-paint inference. The supposedly different full-page PNGs are byte-identical and contain the expected light panel; the discrepancy was in image previews. The unnecessary repaint/frame-wait instrumentation is removed, and both fresh SDK variants and their saved pixels pass. Owned screenshot paths remain. Hosted role/device acceptance is still required independently of this corrected inference.
