# Version 16 physical Android check — 28 November 2026

Riddle Quest Testing version **16**, bundle **40447241201556884**, loaded in the Facebook app on the connected Samsung Galaxy S22 (SM-S901U), Android 16/API 36, Facebook 588.0.0.42.55. IGDebug displayed SDK **8.0**, the exact bundle path `/instant-bundle/2143220529953108/40447241201556884/index.html`, version **16**, and the `standard` environment. Private launch parameters, account images and identifiers are excluded.

The [upload receipt](facebook-testing-version-16-2026-11-28.json) binds this candidate to source `13cfd1cb522b17be775227c07d56c209ec283ad4` and archive SHA-256 `ac32ec82256feea1612bb39b1cb32f249cac45a30f3f0a609d1d7be4a41a8316`. Independent HTTP comparisons matched all 420 runtime files. The provider ZIP container was not downloaded. No SDK replacement, app-controller call or runtime patch was used on this phone.

## Startup and saved progress

Startup was slow but reached the Riddle Quest welcome screen. **Let's Play** restored the kettle puzzle, **1,035 coins** and six editable cells. The clue was: “Which stovetop vessel pours through a spout and can whistle when the water inside boils?”

Five ordinary incorrect guesses — PLANET, BANANA, ROCKET, SILVER and ORANGE — reached **Out of Attempts**. The first-incorrect-guess tutorial was dismissed with **Got it**. Each submitted word was checked in the rendered cells. No hint, coin continuation or paid skip was used; the balance remained 1,035.

## Rewarded-ad failure and recovery

The **Watch an ad for another attempt** action was present and enabled. The first request returned **Service temporarily unavailable. Please try again.** without a visible native ad, continuation or balance change. Controls returned.

A second request showed **Loading**. IGDebug was opened during that preparation, so this attempt is not evidence of an uninterrupted native journey. The game returned to the same loss state; the inspected JS Console contained no diagnostic messages.

After closing IGDebug, a third request was observed without further UI interaction for 22.5 seconds. By the first observation at 2.8 seconds, the ad action had returned enabled; later observations retained that state and 1,035 coins. No native video, reward or continuation was observed. The generic message and empty console do not identify an SDK error code or the failed preparation/eligibility/lifecycle stage. This is failure recovery, not successful mobile rewarded-ad acceptance or proof of a newly introduced regression.

The [local lifecycle regressions](facebook-ad-foreground-lifecycle-2026-11-27.md) remain separate: they establish stale-preparation suppression and already-admitted completion under controlled external fixtures. These phone observations do not prove either native lifecycle ordering or a completed mobile reward.

## Comparison and Testing restoration

At **00:17:04 UTC**, the documented Testing-only API temporarily selected version 15 (`30470981679157112`) for comparison. A fresh phone launch's rendered IGDebug confirmed that exact version and bundle. After **Let's Play**, the same kettle loss state and 1,035 coins returned. One uninterrupted rewarded-ad request reproduced the same generic service-unavailable message, enabled controls and unchanged balance, with no visible ad or continuation. This establishes the failure on the previous client under this phone/account session; it does not identify the underlying cause or prove every version-16 path equivalent.

At **00:19:37 UTC**, the Testing-only API restored version **16**, returning HTTP 200 and the exact bundle ID `40447241201556884`. No new archive was uploaded for this comparison, and no Production endpoint was called.

A read-only request-log query for **00:10:00–00:19:28 UTC** found six HTTP 200 and one HTTP 204 responses for `getfacebookclientconfiguration`, no non-2xx entries, and no `grantfacebookrewardedcontinue` request entries. Only timestamps and statuses were retrieved. These logs do not identify the phone session, reveal configuration contents or establish the independent subscription read's outcome. Firebase remained unchanged.

## Restored version 16 banner and Terms follow-up

A fresh launch after Testing restoration again displayed version **16** and exact bundle `40447241201556884` in IGDebug. This session's complete [rendered Supported APIs list](facebook-android-sdk-capabilities-version-16-2026-11-28.json) contained **48 names**: `loadBannerAdAsync` was newly present relative to the earlier v15 phone observation, with no removed names. The earlier missing-load evidence remains accurate for its own session; support must not be generalized from either list.

A native banner labelled **Ads served by Meta** appeared below the welcome screen and remained below the loss dialog, with game controls laid out above its reserved bottom space. Closing the loss dialog and returning to gameplay removed the visible banner and restored the full game viewport. No ad link was selected. These are native banner appearance/layout/hiding observations; no placement-ID or SDK-call/result trace was captured, and the complete J10 failure, entitlement, pause and retirement matrix remains open.

In Settings, **Terms of Use** opened Facebook's native **Open link in Facebook browser?** confirmation. No banner covered that prompt. **CANCEL** returned to Settings with Terms, Privacy and Quit controls enabled. Successful external navigation was not attempted. Closing Settings returned to the kettle game with Settings and Multiplayer enabled, the temporary unsubmitted letter cleared, and 1,035 coins unchanged. The phone's visible outcome does not independently time the underlying hide promise or prove that every native dialog interleaving is safe.

## Scope

No purchase, social send, invitation, tournament publication, notification opt-in, account deletion, Firebase source/configuration change, provider-server edit or backend deployment occurred. Native mobile rewarded completion, early cancellation, interstitials, subscriber suppression and other applicable acceptance journeys remain open.
