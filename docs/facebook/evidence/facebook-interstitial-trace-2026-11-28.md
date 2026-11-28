# Bounded Facebook interstitial trace — 28 November 2026

Version 22's third-win Android observation showed no interstitial but captured no admission decision or SDK outcome. This change adds local diagnostics to distinguish cadence, suppression, pending preparation and provider outcomes. **It does not identify or fix the cause of version 22's missing-ad observation.** [Version 23 is assigned to Testing](facebook-testing-version-23-2026-11-28.json), with all 420 runtime files verified and the narrow native follow-up below. [Version 22's existing result](facebook-android-ads-version-22-2026-11-28.md) retains its original scope.

## Recorded boundaries

[`FacebookInterstitialTrace`](../../../platforms/web/facebook/src/ads/FacebookInterstitialTrace.ts) owns **54 fixed User Timing mark names** under `riddle-quest:facebook:interstitial:`. The latest accepted completion replaces the previous capture, with at most one mark per allowed phase. Its captured lease prevents late callbacks from an older completion or account visit from contaminating the successor. Explicit retirement closes the visit. Unknown phases and missing/failing Performance APIs cannot create dynamic names or change the existing ad result.

[`FacebookLevelInterstitial`](../../../platforms/web/facebook/src/FacebookLevelInterstitial.ts) records completion, incorrect results, the first two cadence positions and the third-win opportunity. [`FacebookAdsCapability`](../../../platforms/web/facebook/src/FacebookAdsCapability.ts) records admission, fixed suppression reasons, eligibility refresh, native-dialog preparation, SDK create/load/show boundaries and the existing outcome. [`FacebookInterstitialPolicy`](../../../platforms/web/facebook/src/FacebookInterstitialPolicy.ts) exposes the first existing frequency-policy rejection without relaxing admission, cooldowns or the session cap.

Ten documented provider codes map to fixed categories using only an error's own data-property descriptor. Getters, unknown codes and raw messages are not copied. A category identifies an observed code at the surrounding recorded stage; it does not independently prove that the SDK caused an eligibility-stage error. Marks contain no player, receipt, session, placement or account identifiers and no `detail` payload. The new trace does not transmit telemetry or add SDK requests.

## Verification and limits

The final combined run passed **130 tests across five suites in 0.278 seconds**: trace, completed-level cadence, interstitial policy, ad capability and ad preparation. Coverage includes bounded marks, stale leases/retirement, unavailable Performance APIs, accessor-safe error mapping, deferred admission boundaries and preservation of SDK/predicate calls. Shared TypeScript checking and diff checks passed; independent production review reported no findings. These are local checks, not native provider acceptance.

The [exact-version-23 Android follow-up](facebook-android-interstitial-version-23-2026-11-28.md) observed first-win cadence and a native interstitial after three ordinary wins. A second read returned 19 phases through create/load/show resolution, success and finished; result controls recovered and CHESS/1,415 coins survived normal Quit/relaunch. The fixed-mark reader ran twice, with no SDK mutation or debug interaction during the third-win ad. This verifies a narrow native path, not full J09 or the historical failure cause.

Marks retain only each phase's latest occurrence, not complete event history or an exact SDK request count. Missing marks alone cannot prove unsupported APIs, no-fill or callback nonexecution. Instrumentation and opening debug UI may affect scheduling or lifecycle. Existing eligibility, result ownership and SDK behavior remain authoritative.

Firebase/provider-server code and configuration are unchanged. Coverage remains **62 W / 11 C / 6 G**; submission completeness and production/review approval remain unproven.
