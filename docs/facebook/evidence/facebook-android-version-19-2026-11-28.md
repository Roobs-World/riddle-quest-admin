# Version 19 physical Android verification — 28 November 2026

Riddle Quest Testing **19**, bundle **29691804297082520**, was launched at **02:32:42 UTC** on the connected Samsung Galaxy S22, Android 16/API 36, Facebook 588.0.0.42.55. The [acceptance record](facebook-testing-version-19-2026-11-28.json) binds this candidate to clean source `1abd5c9fc09e59868e5651456a5fe2abaf99e048` and archive SHA-256 `32012f0ee1f1d4476c8182e5a1320d6b4fa49c63a79e63f65f953481a4294472`.

The provider received one upload at 02:30:14.737 UTC. A complete recheck at 02:31:24.281109 matched all 420 uncompressed runtime files, each HTTP 200; an earlier comparison had two empty HTTP-200 bodies. No retransmission or source change was needed, and the initial response cause remains unknown. Testing assignment returned HTTP 200 and the exact bundle ID at 02:31:51.791; canonical acceptance was recorded at 02:32:17.672295. This is not a provider ZIP-container download or a separate dashboard processing-field read.

## Observed native behavior

IGDebug's main menu visibly showed SDK **8.0**. Rendered SDK Info at **02:33:51.154380 UTC** confirmed version **19** and `/instant-bundle/2143220529953108/29691804297082520/index.html`. Its list contained **47 API names**, without `loadBannerAdAsync`; this is session-specific advertised support, not a no-fill result. The private identity receipt is `/tmp/riddle-quest-v19-native-sdk-info.json`.

The panel was closed before gameplay. Welcome showed **1,180 coins**. **Let's Play** at **02:34:10** restored the **GUITAR** riddle with five empty rows and 1,180 coins by **02:34:11**. This is restoration of the state left by the earlier version 18 session. No new guess, award, preference change or entitlement operation was performed.

Settings opened and its normal legal/Quit controls were reachable after scrolling. No banner was visibly observed. **Settings → Quit game** at **02:34:40** returned to `com.facebook.katana/.activity.FbMainTabActivity` by **02:34:42**, without the host X menu. The phone was left outside the game and its temporary UI-dump file was removed.

No JavaScript console expression, observer, callback probe, SDK replacement or runtime patch was used in this version 19 check.

## Limits

This is narrow H19 identity, startup/restoration and normal-exit evidence. There was no second launch after this exit, native account replacement, forced stalled save or 15-second timeout observation. The [inactive-owner cleanup](facebook-inactive-settings-owner-cleanup-2026-11-28.md) has focused local regression evidence; these native observations do not exercise that changed branch.

The [version 18 Terms-return stall](facebook-android-terms-quit-followup-version-18-2026-11-28.md) remains unexplained and was not repeated here. Earlier rewarded, social, preference and progression observations keep their original candidate scope. No new purchase, social send, consent change, account deletion, Firebase/configuration change, Production promotion, review submission or publication occurred. Vercel remains the version 15 artifact.

A [later version 19 diagnostic](facebook-android-timer-delivery-version-19-2026-11-28.md) reproduced pending Quit and measured timer non-delivery after the Terms-open/return workflow. It is a separate session with temporary diagnostic records, not part of the probe-free normal-exit check above.
