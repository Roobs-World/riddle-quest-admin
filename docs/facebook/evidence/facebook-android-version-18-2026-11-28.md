# Version 18 physical Android verification — 28 November 2026

Riddle Quest Testing version **18**, bundle **29215929211369652**, was verified in rendered SDK Info around **01:48:39 UTC** on the connected Samsung Galaxy S22, Android 16/API 36, Facebook 588.0.0.42.55. It displayed SDK 8.0, version 18 and the exact path `/instant-bundle/2143220529953108/29215929211369652/index.html`. The [public acceptance record](facebook-testing-version-18-2026-11-28.json) binds this candidate to clean source `543c5791aa7e76345fb1b20906700bb0a629d188` and archive SHA-256 `de3f0246fdf9db49412f585e192ea530965592b243690a282ec4e103ff0fb233`.

The archive was uploaded once at 01:44:32 UTC. Testing assignment returned HTTP 200 and the exact bundle ID at 01:47:26 UTC. The first independent comparison at 01:48:02 UTC matched all 420 uncompressed runtime files. Canonical acceptance was recorded. This is not a download/hash of the provider ZIP container or a fresh Production-state read.

## Startup, saved progress and normal Quit

After closing SDK Info and selecting **Let's Play** around **01:48:57 UTC**, the game restored the **PENCIL** riddle, six empty editable answer cells and **1,155 coins**. This confirms restoration of the state left after the version 17 normal Quit. No debug console expression, observer, SDK replacement or runtime patch was used during startup, the normal exits, preference persistence or social checks. The later bounded diagnostic phase is explicitly separate below.

A Meta banner appeared beneath Settings and the layout reserved its bottom space. An initial coordinate tap used the preceding full-height layout and did not establish a Quit request; it is excluded from action evidence. After a fresh screen observation, **Quit game** was selected at **01:49:42 UTC**. By **01:49:44 UTC**, Android's top-resumed activity was `com.facebook.katana/.activity.FbMainTabActivity`, establishing normal app-initiated exit without the host X control. No advertiser CTA was selected.

The game was relaunched through the same game URL with the version 18 Testing assignment unchanged. It restored 1,155 coins and the same puzzle. The rendered Settings showed **Reduced motion Off**. At **01:50:28 UTC**, that preference was toggled; Quit was selected five seconds later at **01:50:33 UTC**. By 01:50:35 UTC, Facebook's main activity was resumed. After relaunch, Settings visibly showed **Reduced motion On** around **01:51:08 UTC**, with the PENCIL puzzle and 1,155 coins unchanged. It was restored to **Off** at **01:51:18 UTC**. Off persistence after a later fresh launch is recorded below.

## Android social cancellation and discovery

After acknowledging the eight visible Profile tutorial steps, **Invite a friend** was selected at **01:52:10 UTC**. Meta opened a native invitation sheet with Riddle Quest challenge copy. Its X was selected at **01:52:35 UTC** without choosing a recipient or pressing Send. Profile returned with Invite enabled, 1,155 coins and 18 wins unchanged. Closing Profile returned to gameplay.

**Race to 10 → Play on Facebook** showed **Friends who play: 0** and an empty Facebook tournament list. At **01:53:08 UTC**, Refresh was selected and the lobby was closed and reopened. Expanding the discovery section again showed the same empty state and usable navigation. No request timing or response trace was captured, so closing during an actually outstanding request is not established. No Room control was observed in the displayed section; this is not a global API support claim.

The separate **Play with friends** action at **01:53:35 UTC** opened Meta's native context chooser. Its X was selected at **01:53:46 UTC**, without selecting another player or pressing Play. The lobby returned with Play with friends and Start PvP match available. No invitation, context membership, matchmaking, tournament creation/join or multiplayer participation was completed. No personal recipient information is retained in this document.

## Terms navigation and subsequent Quit check

**Settings → Terms of Use** opened Meta's external-link confirmation. Selecting **OPEN LINK** at **01:54:15 UTC** opened the Facebook browser on `roobsworld.com`, visibly showing **Riddle Quest Terms of Service**. No cookie choice was changed. Android Back at **01:54:25 UTC** returned to Settings with 1,155 coins unchanged. The subsequent **Quit** tap at **01:54:34 UTC** left native Settings actions greyed out through **01:55:27 UTC**, at least 53 seconds. No unsaved-progress outcome was observed. No DOM busy-action inspection was captured at that point, so this does not establish whether a new Quit was admitted, the earlier Terms promise retained ownership, or a banner preparation was pending.

A diagnostic phase then opened IGDebug. One read-only console expression at **01:56:11.030 UTC** reported visibility **visible** and exact version 18 bundle **true**; its Promise microtask logged after **11 ms**. A one-shot animation-frame callback and a ten-second timer had produced no visible output by **01:56:22 UTC**. This suggests delayed callback delivery but does not prove a host-wide timer suspension or identify the blocked SDK operation. No SDK method was called or replaced by that expression.

A subsequent read-only DOM probe was prepared but **not submitted**: its transport required an exact fresh console editor, and the UI dump instead showed Facebook Home with no editor or IGDebug. That dump was written at **01:56:56 UTC**; the main Facebook activity was confirmed at **01:57:22 UTC**. The game therefore exited during diagnostic preparation, before the later Android Back used in an attempted keyboard dismissal. The exact exit time and cause were not observed. This is not a clean unattended Quit success, proof of the new 15-second recovery, or proof that the underlying return-from-browser failure is fixed. Probe callbacks were removed by the ensuing fresh host launch; no observer or runtime patch was installed.

Read-only source tracing identifies two operations outside the new Quit-preparation timer: pending external-link ownership and the banner guard before action execution. The latter serializes native hide behind earlier banner work. Neither path was identified by the unavailable DOM probe, so no speculative guard or host-timer correction was made.

Meta's [current external-link contract](https://developers.facebook.com/documentation/games/sdk-reference/v8.0#openexternallinkasync), freshly fetched on 28 November, resolves after confirmation and attempted opening. It does not define the promise as a return-to-game handshake. The [resume callback](https://developers.facebook.com/documentation/games/sdk-reference/v8.0#onresume) supplies an event, without an Android-Back timer-restoration guarantee. The public SDK routes the link through the native host. These contracts do not justify bypassing save ordering or native-dialog ownership. No documented client workaround was established.

## Final relaunch, restored preference and exit

A fresh launch removed the diagnostic callbacks. Rendered SDK Info at **01:59:38 UTC** reconfirmed version **18** and the exact bundle path. The game again restored PENCIL and **1,155 coins**. Around **02:00:10 UTC**, Settings displayed **Reduced motion Off**, verifying restoration of the original preference across the intervening exit. Notifications remained Off and the analytics checkbox remained unchecked; neither was changed.

The final **Settings → Quit** at **02:00:39 UTC** returned to Facebook's main activity by **02:00:41 UTC**. The phone was left outside the game with no debug panel or diagnostic callback active. The temporary UI-dump file was removed. This later normal exit does not erase the earlier post-Terms pending state.

## Scope and remaining checks

The [Quit correction](facebook-quit-preparation-recovery-2026-11-28.md) bounds preparation while preserving pending save ordering. The native normal exits above do not exercise the 15-second timeout, delayed callbacks or fresh retry after an unresolved save; those branches have focused local regression evidence. No native hang was forced, and the underlying version 17 post-navigation stall remains unexplained.

The normal save and two Android dialog-cancellation observations above are narrow acceptance results. The post-Terms pending state remains unresolved. The restored Off preference passed its final relaunch check. Rewarded playback success on version 17 remains separate historical evidence; it has not been repeated on version 18. Production promotion, review submission and publication were not performed. Vercel remains the version 15 artifact. Firebase, provider-server source/configuration and the notification manager remain unchanged. No purchase, social send, notification opt-in or account deletion occurred.
