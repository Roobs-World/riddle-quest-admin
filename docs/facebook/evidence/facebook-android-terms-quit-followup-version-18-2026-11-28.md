# Version 18 Android Terms-return/Quit follow-up — 28 November 2026

This diagnostic follows the [result-share check](facebook-android-result-share-version-18-2026-11-28.md) on the same Galaxy S22/Android 16/Facebook 588.0.0.42.55. Testing **18**, bundle **29215929211369652**, remained unchanged; see the [acceptance record](facebook-testing-version-18-2026-11-28.json).

Fresh rendered SDK Info at **02:18:29.607781 UTC** confirmed version 18 and `/instant-bundle/2143220529953108/29215929211369652/index.html`. It listed **47 APIs**, without `loadBannerAdAsync`. This is session-specific support, not a no-fill result. The local identity receipt is `/tmp/riddle-quest-v18-terms-followup-sdk-info.json`. Gameplay showed GUITAR and **1,180 coins**.

## Reproduction

**Terms of Use** at **02:19:03 UTC**, followed by **OPEN** at **02:19:10**, displayed Riddle Quest Terms on `roobsworld.com`. Cookie choices were unchanged. Android Back at **02:19:20** returned to Settings with actions visually enabled.

**Quit** at **02:19:31** greyed the controls. Android still reported the Quicksilver game activity at **02:19:33**. No exit or unsaved-progress recovery was established at that point.

## Read-only diagnostic observations

IGDebug was then opened. One pure DOM expression at **02:20:14.994 UTC** reported:

- Document visibility: `visible`; paused: `false`.
- Busy action text: `Quit game ›`.
- Banner present: `false`; banner inert: `false`.

An initial extractor assertion missed the label’s arrow; a fresh UI dump yielded the corrected receipt at **02:21:49**, `/tmp/riddle-quest-v18-terms-quit-dom-result.json`, without another runtime probe. The busy label identifies Quit, not the blocked save, presence, guard or native operation.

A separate one-shot scheduler expression at **02:21:30.127** synchronously reported visible/exact-version-18 state; its Promise microtask logged after **5 ms**. No animation-frame or ten-second timer output was visible by **02:21:49.892**. Delayed callback delivery does not prove host-wide suspension or the native cause. No SDK call, SDK replacement, observer or runtime patch was used.

A fresh UI receipt at **02:22:48.862 UTC** confirmed IGDebug, its JavaScript console/editor and the Quit text remained present. The scheduler logs still contained only Start, Scheduled and the 5 ms microtask, with no frame/timer output approximately 78 seconds after scheduling. Home at **02:23:33**, followed by Recents and selection of the Facebook card at **02:23:43**, returned to the same console and greyed Quit state, without additional frame/timer output by **02:23:45**. No recovery was observed; lifecycle callbacks were not traced.

The host top X at **02:24:00** opened its native Quit menu. Host **Quit** at **02:24:07** reached **FbMainTabActivity** by **02:24:10**. This was an explicit host exit, not recovery of the app Quit pending since 02:19:31. The temporary device UI XML was removed. Fresh launch at **02:25:02** showed welcome/1,180 coins at **02:26:00**. **Let’s Play** at **02:26:07** restored GUITAR’s empty board/1,180 by **02:26:08**. Testing assignment was unchanged; SDK Info was not reread. No probe or diagnostic callback was installed in this session. Normal app Quit at **02:26:36** reached **FbMainTabActivity** by **02:26:38**. The phone was left outside the game. This later success does not resolve the Terms-return stall.

## Limits

Normal Quit successes and local 15-second preparation tests remain separate. This does not establish native timeout recovery. Separately identified source defects do not establish this incident’s cause. No artifact upload, Firebase/configuration change, Production promotion, review submission or publication occurred for this diagnostic.
