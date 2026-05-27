# Sentry Issues

Last synced from live Sentry on 2026-05-27. Sentry timestamps below are UTC.

Project: `qwordly`
Query: `is:unresolved`

Each checkbox stays open until the code path is fixed or intentionally reclassified, verified in-app, and the matching Sentry issue is resolved or muted with a documented reason.

## Startup, Navigation, And Native Registration

- [ ] QWORDLY-2S (fatal, last seen 2026-05-27T01:03:25Z, count 2, users 1): Fix duplicate native view registration for `RNSTabsHostAndroid`. Culprit: `invariant(E:\qwordly\node_modules\invariant\browser.js)`. Sentry: https://roobs-world-limited.sentry.io/issues/122926172/
- [ ] QWORDLY-2P (fatal, last seen 2026-05-27T01:03:25Z, count 1, users 1): Fix duplicate native view registration for `RNSFullWindowOverlay`. Culprit: `invariant(E:\qwordly\node_modules\invariant\browser.js)`. Sentry: https://roobs-world-limited.sentry.io/issues/122926162/
- [ ] QWORDLY-2R (fatal, last seen 2026-05-27T01:03:25Z, count 1, users 1): Fix duplicate native view registration for `RNSScreenFooter`. Culprit: `invariant(E:\qwordly\node_modules\invariant\browser.js)`. Sentry: https://roobs-world-limited.sentry.io/issues/122926165/
- [ ] QWORDLY-2K (fatal, last seen 2026-05-27T01:03:25Z, count 5, users 1): Fix duplicate native view registration for `RNSScreenContentWrapper`. Culprit: `invariant(E:\qwordly\node_modules\invariant\browser.js)`. Sentry: https://roobs-world-limited.sentry.io/issues/122926146/
- [ ] QWORDLY-2N (fatal, last seen 2026-05-27T01:03:25Z, count 1, users 1): Fix duplicate native view registration for `RNSSearchBar`. Culprit: `invariant(E:\qwordly\node_modules\invariant\browser.js)`. Sentry: https://roobs-world-limited.sentry.io/issues/122926150/
- [ ] QWORDLY-2Q (fatal, last seen 2026-05-27T01:03:25Z, count 1, users 1): Fix duplicate native view registration for `RNSModalScreen`. Culprit: `invariant(E:\qwordly\node_modules\invariant\browser.js)`. Sentry: https://roobs-world-limited.sentry.io/issues/122926164/
- [ ] QWORDLY-2M (fatal, last seen 2026-05-27T01:03:25Z, count 2, users 1): Fix duplicate native view registration for `RNSScreenStackHeaderConfig`. Culprit: `invariant(E:\qwordly\node_modules\invariant\browser.js)`. Sentry: https://roobs-world-limited.sentry.io/issues/122926147/
- [ ] QWORDLY-2J (error, last seen 2026-05-27T01:02:56Z, count 1, users 1): Fix `ReferenceError: Property 'Stack' doesn't exist` in `src/navigation/NavigationStack.tsx`. Culprit: `Navigation(E:\qwordly\src\navigation\NavigationStack.tsx)`. Sentry: https://roobs-world-limited.sentry.io/issues/122926085/
- [ ] QWORDLY-2H (error, last seen 2026-05-24T15:24:31Z, count 1, users 1): Fix missing safe-area provider context for Coin Shop (`No safe area value available`). Culprit: `CoinShop(E:\qwordly\src\components\shop\CoinShop.tsx)`. Sentry: https://roobs-world-limited.sentry.io/issues/122317845/
- [ ] QWORDLY-2E (fatal, last seen 2026-05-24T12:20:34Z, count 4, users 1): Fix or document Metro/runtime `Error: Requiring unknown module "react-native"` failure. Culprit: `unknownModuleError(E:\qwordly\node_modules\@expo\cli\build\metro-require\require.js)`. Sentry: https://roobs-world-limited.sentry.io/issues/122288853/

## Initialization, Assets, And Timeouts

- [ ] QWORDLY-21 (error, last seen 2026-05-27T01:35:27Z, count 6, users 4): Fix or classify startup `Error: Operation timed out after 15000ms` from `App.tsx`. Culprit: `setTimeout$argument_0(E:\qwordly\App.tsx)`. Sentry: https://roobs-world-limited.sentry.io/issues/115080012/
- [ ] QWORDLY-20 (error, last seen 2026-05-24T13:09:14Z, count 21, users 2): Fix asset preloading/download handling for `ExpoAsset.downloadAsync` rejection. Culprit: `constructor(E:\qwordly\node_modules\expo-modules-core\src\errors\CodedError.ts)`. Sentry: https://roobs-world-limited.sentry.io/issues/115080009/
- [ ] QWORDLY-2F (error, last seen 2026-05-24T13:09:08Z, count 1, users 1): Fix or classify `Error: Operation timed out after 15000ms` from bundled Android runtime. Culprit: `anonymous(index.android)`. Sentry: https://roobs-world-limited.sentry.io/issues/122297151/

## Ads, Purchases, Auth, And Provider Flows

- [ ] QWORDLY-2G (error, last seen 2026-05-24T13:45:23Z, count 8, users 0): Stop reporting expected Google Mobile Ads no-fill events as Sentry errors, or add user-visible fallback handling if this indicates broken ad readiness. Culprit: `_handleAdEvent(E:\qwordly\node_modules\react-native-google-mobile-ads\src\ads\MobileAd.ts)`. Sentry: https://roobs-world-limited.sentry.io/issues/122297226/
- [ ] QWORDLY-15 (error, last seen 2026-05-23T23:20:27Z, count 4, users 2): Fix or gracefully classify `[react-native-iap]: PurchaseError: Failed to initialize connection`. Culprit: `createPurchaseError(E:\qwordly\node_modules\react-native-iap\lib\module\utils\errorMapping.js)`. Sentry: https://roobs-world-limited.sentry.io/issues/111777529/
- [ ] QWORDLY-2B (error, last seen 2026-05-23T21:36:28Z, count 1, users 1): Fix or gracefully classify bundled Android `[react-native-iap]: PurchaseError: Failed to initialize connection`. Culprit: `createPurchaseError(index.android)`. Sentry: https://roobs-world-limited.sentry.io/issues/122184857/
- [ ] QWORDLY-2D (error, last seen 2026-05-23T23:01:27Z, count 1, users 1): Fix callable auth handling for `Error: Unauthenticated`, or suppress/report as expected only when triggered by an anonymous/expired session UX path. Culprit: `<anonymous>(E:\qwordly\node_modules\@react-native-firebase\functions\dist\module\namespaced.js)`. Sentry: https://roobs-world-limited.sentry.io/issues/122192132/
- [ ] QWORDLY-29 (error, last seen 2026-05-23T22:16:58Z, count 1, users 0): Fix Facebook login `TypeError: function's '.prototype' is not an object in 'instanceof'`. Culprit: `handleFacebookSignIn(E:\qwordly\src\screens\LandingScreen.tsx)`. Sentry: https://roobs-world-limited.sentry.io/issues/115286392/
- [ ] QWORDLY-2A (error, last seen 2026-05-23T22:16:57Z, count 1, users 0): Stop reporting user-cancelled Facebook login as an error, or classify it below issue-alerting severity. Culprit: `signInWithFacebook(E:\qwordly\src\services\AuthService.ts)`. Sentry: https://roobs-world-limited.sentry.io/issues/115286393/
- [ ] QWORDLY-2C (error, last seen 2026-05-23T22:14:37Z, count 1, users 0): Stop reporting user-cancelled Google sign-in as an error, or classify it below issue-alerting severity. Culprit: `runOnMainThread$argument_0(E:\qwordly\src\services\AuthService.ts)`. Sentry: https://roobs-world-limited.sentry.io/issues/122188414/
