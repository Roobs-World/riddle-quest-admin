# Chrome access and version 23 desktop check — 28 November 2026

The existing Facebook personal profile in Chrome loaded **Testing version 23**, bundle **40683991141214635**, with SDK **8.0 / WEB**. The game restored CHESS and **1,415 coins**, followed host display-mode changes, opened Terms through Facebook's confirmation, and exited through the game’s Quit action after returning. A fresh launch restored the same state and a second ordinary Quit completed cleanup. The [structured record](facebook-chrome-access-2026-11-28.json) preserves the observations and 15 scoped private receipt hashes.

Chrome initially used the Riddle Quest Page profile. At **08:41:58.860 UTC**, the game route displayed a configuration error with no game iframe. Selecting the already available personal profile through Facebook’s account menu resolved access; no credentials, verification-code retries or role changes were needed. The initial error does not establish an artifact failure or a public-review outcome.

At **08:44:51.514**, the loaded frame identified version 23 and its exact bundle. The post-start read at **08:46:04.722** confirmed the same **50 advertised APIs**, the saved puzzle/balance and `NORMAL` / `data-facebook-display-mode="normal"`. The first read still displayed Loading 100%; gameplay readiness belongs to the later read.

| Desktop journey | Bounded observation |
|---|---|
| Activity and tournaments | Activity settled with no completed matches. Both tournament lists settled empty; the native panel showed Friends who play: 0 and an enabled Refresh control. No recipient, invitation, join or score submission was attempted. |
| Host Collapse / Expand | SDK and DOM modes changed **NORMAL → EXPANDED → NORMAL** at 08:46:04.722, 08:46:52.241 and 08:47:02.391. The portrait viewport remained 430 × 765. |
| Optional actions | No overlay, community or payment APIs were advertised; the complete bot-consent triplet was also absent. These flows were skipped. Both shortcut APIs were advertised, but no shortcut action appeared in Settings; no prompt or cancellation was exercised. |
| Terms → return → Quit | The native confirmation displayed the fixed Terms URL and Follow link. Following it opened the actual [Riddle Quest Terms](https://roobsworld.com/riddle-quest/terms), observed at 08:48:08.258. Closing that owned tab restored enabled Settings actions and visible state at 08:48:21.029. One game Quit reached `/gaming/play/` with no game iframe by 08:48:27.466. |
| Relaunch and cleanup | At 08:49:13.243, exact version 23 restored CHESS, 1,415 coins and 25 empty cells with the first five enabled. One ordinary game Quit was followed by an initial still-loaded observation at 08:49:20.687 and `/gaming/play/` with no iframe at 08:49:26.205. |

The relaunch advertised **49 APIs**: `loadBannerAdAsync` was absent while `hideBannerAdAsync` remained present. This differs from the first session’s 50-API list; neither list establishes every optional feature’s eligibility or acceptance. Empty discovery results do not establish multiplayer delivery, a pending-read cancellation race or native overlays.

The first Quit removed the game frame before its diagnostic phase read could complete. A descendant-only pause probe excluded the game main element itself, so it establishes no pause-state result. No complete Quit trace, exact exit latency or newly written gameplay save is claimed. The previously saved state survived the observed sequence; no new puzzle or reward was earned. **The separate Android post-Terms persistence stall remains unresolved.** Desktop exit does not certify Android recovery or complete J04 and the wider host matrix.

The owned game tab was closed after the final native exit; preexisting user tabs were preserved.

The [immutable version 23 acceptance record](facebook-testing-version-23-2026-11-28.json) is unchanged. [Earlier dashboard evidence](facebook-dashboard-followup-2026-11-28.md) still records Testing 23 / Production 9 and its own finite Chrome-sign-in-pending scope. No source, Firebase/provider-server configuration, provider setting, assignment, build, upload, review submission or publication changed. The 79-entry coverage classifications remain **62 W, 11 C and 6 G**.
