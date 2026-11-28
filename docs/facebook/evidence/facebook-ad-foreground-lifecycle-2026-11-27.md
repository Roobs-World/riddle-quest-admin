# Facebook ad foreground lifecycle — 27–28 November 2026

The owner authorized focused tests and browser verification. This records a reproduced client defect and its local fix on `facebook`; it is not native Meta acceptance or an upload receipt. Firebase, provider servers and the notification manager were not changed.

Final handoff: **28 November 2026, 00:00 UTC**. The complete browser run finished at **27 November 2026, 23:59:39 UTC**; the filename retains the work's starting date.

## Reproduction and cause

The real-entry browser fixture held a rewarded ad's `loadAsync`, delivered the registered native pause callback, verified `.game-app.paused` while the document remained visible, and then completed loading. Before the fix, `showAsync` still ran:

```text
Expected length: 0
Received length: 1
Received array: ["rewarded:show"]
```

The same focused command reproduced this twice, in **6.561 s** and **6.622 s**. The existing `isActive` predicate checked the account/deletion lifetime, which remains valid during a foreground interruption. That predicate could not also establish permission to begin a new native ad display.

`FacebookAdPresentation` now captures each attempt's foreground visit. Native pause or hidden visibility permanently revokes that attempt, including a pause/resume or hidden/visible round trip before loading settles. A later explicit attempt captures the new visit. Account ownership remains independent: once `showAsync` has started, pause does not discard an earned continuation or prematurely release native-dialog ownership. Entry retirement removes this owner's lifecycle and visibility listeners.

## Verification

| Check | Result |
| --- | --- |
| Original focused reproduction after the fix | Passed, **6.648 s** |
| Expanded focused lifecycle journey | Passed, **13.343 s** |
| Complete Facebook browser journey, including lifecycle scenarios | **1 test / 1 suite passed**, **42.245 s** |
| Focused ad/bootstrap/lifecycle regressions | **100 tests / 6 suites passed**, **0.338 s** |
| Banner lifecycle regression suite | **13 tests passed**, **0.197 s**; four new native-pause/visibility cases passed independently in **0.191 s** |
| Shared TypeScript check | Passed |
| Browser fixture build and artifact audit | **420 runtime files**, **4.51 MB total**, **0.71 MB initial resources**; no Jest gaming SDK, native-module or secret leakage |
| `git diff --check` | Passed |

The browser regression exercises rewarded creation/loading under native pause and hidden visibility, both with and without returning to the foreground before settlement. Stale attempts never display, never issue a continuation grant, preserve balance and restore controls. Every scenario then opens a fresh rewarded ad; pausing after display begins preserves its pending modal and grants exactly one continuation on completion, with unchanged coins and restored editable cells.

The interstitial cases reach the real third-win opportunity through Classic play, interrupt deferred load or creation, return to the foreground before settlement, and verify no stale display or balance change. A cancelled native share proves the prior attempt released the shared dialog gate. Adapter regressions additionally cover both preparation phases and formats, fresh retry after invalidation, and exclusive ownership until an already-admitted native display settles.

The full journey continues to exercise cancellation/no-fill, earned-claim transport retry, subscription changes, banner/dialog ordering, overlays, saves, commerce cancellation and account replacement. Lifecycle scenarios reset only their ephemeral local browser origin's storage after navigating away, so prior journey drafts cannot contaminate them. SDK, HTTP and visibility responses are external fixtures; no game controller is called directly.

Four older ad stubs in `FacebookPlatformBootstrap.test.ts` lacked the already-required `getPlacementID` method. They now return their exact configured placement so those existing dialog-serialization tests reach ad loading again. Production placement checks were not weakened. Historical screenshots rewritten by the complete harness were restored.

Separate banner regressions use the real Facebook lifecycle fan-out. A late load is hidden before a waiting dialog is admitted, and a retired owner cannot reload on later resume/visibility signals. No banner production defect was reproduced; its implementation is unchanged.

## Commands and local logs

```bash
PORTAL_BROWSER_TESTS=1 FACEBOOK_BROWSER_AD_LIFECYCLE=1 pnpm exec jest --runInBand --runTestsByPath platforms/web/facebook/src/__tests__/facebookBrowser.jest-playwright.test.ts

PORTAL_BROWSER_TESTS=1 pnpm exec jest --runInBand --runTestsByPath platforms/web/facebook/src/__tests__/facebookBrowser.jest-playwright.test.ts

pnpm exec jest --runInBand --runTestsByPath platforms/web/facebook/src/__tests__/FacebookAdPreparation.test.ts platforms/web/facebook/src/__tests__/FacebookAdsCapability.test.ts platforms/web/facebook/src/__tests__/FacebookRewardedContinue.test.ts platforms/web/facebook/src/__tests__/FacebookLevelInterstitial.test.ts platforms/web/facebook/src/__tests__/FacebookPlatformBootstrap.test.ts platforms/web/facebook/src/__tests__/createFacebookLifecycle.test.ts

pnpm check:types:shared
git diff --check
```

Logs: `/tmp/riddle-quest-facebook-ad-lifecycle-red.log`, `-red-repeat.log`, `-green.log`, `-expanded.log`, `-full-browser.log`, `-units.log` and `-types.log`, with the common `/tmp/riddle-quest-facebook-ad-lifecycle` prefix.

The harness built isolated temporary artifacts. No new Meta upload, Testing assignment, production promotion, Vercel deployment, publication, payment, message or review submission occurred in this verification unit. Supported native-host acceptance remains governed by [J02/J09/J14](../facebook-api-submission-checklist-2026-11-27.md).
