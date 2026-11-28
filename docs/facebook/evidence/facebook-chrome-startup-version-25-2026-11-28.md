# Version 25 Chrome startup and reload check — 28 November 2026

**Initial startup and in-game Retry failed; a full Facebook host-page reload reached playable Riddle Quest.** This is not native acceptance of the new 30-second timeout or successful recovery through Retry alone. The [structured record](facebook-chrome-startup-version-25-2026-11-28.json) preserves private receipt hashes for the unchanged **Testing version 25 / bundle 30120031574249440 / SDK 8.0 WEB**.

- At **10:35:13.841 UTC**, Startup failed and enabled Retry were visible at **24,222.4 ms document age**. The failure was already present before a 30-second document age; the failing stage and cause were not established.
- The in-game Retry was clicked. At **10:36:36.416**, Startup failed and enabled Retry remained. Ready gameplay was not established through that action.
- A subsequent **full host-page reload** reached loading completion, the welcome screen and then gameplay. At **10:37:47.568**, the exact candidate reported **49 APIs**, restored **1,610 coins** and PEACOCK with **35 empty cells, seven enabled**, and had no notices or paused root class. The receipt records the API count, not a complete method list.
- At **10:38:29.515**, Multiplayer showed **Play / Activity**, enabled normal friend/opponent controls, and no separate Play on Facebook or tournament surface. No social/opponent action was invoked. Settings was enabled at **10:38:39.568**, without notices; Sound remained On and Reduced Motion Off.

Normal game Quit reached `/gaming/play/` at **10:39:21.815**, with **one total iframe** recorded. The owned game tab was closed at **10:39:22** and preexisting tabs preserved. No relaunch followed this Quit, no new gameplay award was earned and no phone was used.

The initial failures remain unexplained. Full host reload restoration does not prove that the timeout fired or fix the underlying cause. The [startup deadline tests](facebook-startup-recovery-2026-11-28.md) remain controlled local evidence. This narrow check establishes restored state and the current UI, not new-progress saving, social delivery, full submission acceptance or repair of the separate Android issue. Total iframe count is not a game-frame identity trace or exact exit latency.

No source, Firebase/provider-server code or configuration, build/upload, backend deployment, Meta configuration, Vercel deployment, Production promotion, publication or review submission changed during this check. No SDK mutation was performed. The [upload receipt](facebook-testing-version-25-2026-11-28.json) retains every canonical acceptance field. Coverage remains **51 W / 10 C / 6 G / 12 X**.
