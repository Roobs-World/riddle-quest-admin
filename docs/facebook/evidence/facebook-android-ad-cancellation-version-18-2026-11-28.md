# Version 18 Android rewarded-ad cancellation — 28 November 2026

Riddle Quest Testing **18**, bundle **29215929211369652**, was checked on the connected Samsung Galaxy S22, Android 16/API 36, Facebook 588.0.0.42.55. Rendered SDK Info at **02:05:31.230011 UTC** confirmed version 18 and `/instant-bundle/2143220529953108/29215929211369652/index.html`. The failed 02:04:46 identity-read selection is excluded. The [acceptance record](facebook-testing-version-18-2026-11-28.json) binds this unchanged candidate to source `543c5791aa7e76345fb1b20906700bb0a629d188` and archive SHA-256 `de3f0246fdf9db49412f585e192ea530965592b243690a282ec4e103ff0fb233`.

## Cancelled reward

Normal on-screen guesses against PENCIL were BANANA at **02:05:02**, BOTTLE at **02:05:50**, GUITAR at **02:05:57**, ORANGE at **02:06:05** and TOMATO at **02:06:12 UTC**. All were incorrect. The balance remained **1,155 coins**; no hint or coin spend was used.

Selecting **Watch an ad** at **02:06:20** displayed a real native video with **Reward in 12s** visible. The top-right skip control at **02:06:41** opened a native warning that skipping would lose the reward. **LOSE REWARD** at **02:06:49** led to the end card. Closing its X at **02:06:58** returned to **Out of Attempts**, with **Watch an ad** enabled, **1,155 coins unchanged** and no extra attempt.

No SDK observer, hook, console expression or IGDebug was active during the ad. No advertiser call to action was selected.

## Retry and final exit

One retry through the normal **Watch an ad** button at **02:08:11 UTC**, 73 seconds after the end-card close, returned **Service temporarily unavailable** within two seconds. The loss dialog returned with **1,155 coins unchanged**, without a video or continuation. No raw error code or failed-stage trace was captured; no no-fill, quota or root-cause conclusion follows. Closing the returned loss dialog subsequently exposed a loading/error screen with a spinner, **Service temporarily unavailable** and a plain **Settings** recovery button, still at 1,155 coins. Recovery timing remained unresolved. No further ad retry was made.

At **02:11:09**, a tap at the earlier recovery-button coordinates was followed by PENCIL with five empty rows and 1,155 coins. Whether recovery preceded or followed that tap is unknown. The gear opened Settings at **02:11:20**; Reduced motion/Notifications remained Off and analytics unchecked. Normal app Quit at **02:11:51** reached **FbMainTabActivity** by **02:11:53**. No IGDebug or probes were used; the temporary device UI dump was removed.

## Limits

Cancellation/no extra attempt is established only at the immediate cancellation boundary. Read-only source tracing shows that declining continuation reloads the same Classic level after loss finalization, which is consistent with the empty board; no request trace identifies that later session. The later board does not establish a rewarded grant or full gameplay acceptance. No raw SDK cancellation code, network claim trace or server-side outcome was captured. It does not establish no-fill, interrupted display, subscription suppression, duplicate-claim behavior or the wider ad matrix. The [earlier version 18 Terms-return stall](facebook-android-version-18-2026-11-28.md) remains unresolved. No new upload, Firebase/configuration change, Production promotion, review submission or publication was performed for this check.
