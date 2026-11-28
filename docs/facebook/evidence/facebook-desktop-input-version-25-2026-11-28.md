# Version 25 desktop input and developer-overlay check

**Two Facebook-hosted desktop launches reached playable Riddle Quest without Retry. A Meta developer overlay intercepted the on-screen Backspace position; a fresh launch with that overlay temporarily disabled accepted both on-screen letter entry and Backspace.** This is narrow desktop evidence for unchanged [Testing version 25](facebook-testing-version-25-2026-11-28.json), bundle `30120031574249440`, not completion of the submission matrix.

## Observations

All times are UTC on 28 November 2026. The game viewport was 430 × 765 CSS pixels.

- At 10:52:50.670 the exact bundle showed `Loading 100%`, at approximately 18,883 ms document age. The later 10:55:07.995 observation showed ready Classic gameplay, 1,610 coins and the PEACOCK riddle without Retry. These separated observations do not measure startup latency. No startup failure was reproduced in this check, and the [earlier version 25 failures](facebook-chrome-startup-version-25-2026-11-28.md) remain unresolved.
- On-screen A entered at 10:55:16.896. The subsequent center click at Backspace opened the Meta IGDebug panel; A remained at 10:55:24.852 despite that receipt's misleading `input-cleared` filename. The panel was closed through its ordinary header X.
- At 10:56:16.515 the collapsed debug control occupied `(366, 619, 54, 46)`. The Backspace rectangle was `(371.125, 599.53125, 50.875, 48)`, whose center lies inside that control. Hit testing put the pointer-enabled debug element above the Backspace button. Physical Backspace cleared all 35 cells by 10:58:30.185; 1,610 coins remained visible.
- Meta's [Debugging Tool documentation](https://developers.facebook.com/documentation/games/build/zero-permissions/debugging-tool) describes a per-app developer-test overlay controlled by the Web Hosting Debug Mode toggle, rather than a per-bundle setting. The toggle was temporarily switched off. The 10:59:20.098 dashboard receipt confirmed debug disabled, Testing 25 and Production 9.
- Normal game Quit reached `/gaming/play/` by 10:59:37.402, with only the `/maw_proxy_page/` iframe remaining. The earlier 10:59:29.350 receipt still contained the game iframe and is not the completion receipt.
- A fresh launch showed the same exact bundle ready at 11:00:23.491, with no debug boundary and 1,610 coins. Hit testing at 11:00:34.576 reached the Backspace image/button. On-screen A entered at 11:00:47.175; on-screen Backspace left all 35 cells empty at 11:00:47.736. The game remained unpaused with no notice and unchanged coins.
- After restoring Debug Mode and freshly navigating Web Hosting, the 11:02:33.015 receipt confirmed `debugEnabled:true`, Testing 25 and Production 9. The immediate post-click snapshot was transient and is not restoration evidence.
- Final normal Quit reached `/gaming/play/` at 11:03:47.474 with only `/maw_proxy_page/` remaining. Cleanup recorded at 11:03:55 confirms the owned Chrome game and Firefox dashboard tabs were closed while pre-existing tabs were preserved.

The controlled comparison supports developer-overlay pointer interception for this Backspace symptom. It does not establish a general keyboard defect, explain earlier startup failures or verify a real desktop hidden/resume transition. No answer was submitted, reward earned, notification sent, consent changed or direct SDK mutation performed. No application source, upload, Firebase/provider backend or Production assignment changed. The only temporary Meta setting change was Debug Mode, subsequently confirmed restored. The question about the user's availability for a manual desktop check remained unanswered; no hidden/resume action was performed or claimed.

## Private evidence

Screenshots remain private because the surrounding Facebook UI contains personal information. The following receipt hashes preserve the observed states without copying that UI into the repository. Receipt names beginning `rq-facebook-v25-` are in `/tmp/`, except the three dashboard/source locations identified below.

| Private receipt | SHA-256 |
| --- | --- |
| `rq-facebook-v25-startup-recheck-initial.json` | `fc024793a58d3098261862e0cc220375a337534b3c9e19af7c34c087e6165295` |
| `rq-facebook-v25-startup-recheck-ready.json` | `e70c6426df05b2b470379f3be3ccdb420c8242b4792260987969509a936e9d90` |
| `rq-facebook-v25-input-letter.json` | `eb5690a923ac50da08625293d77d007224bc9839072dd587df0544402cafc2bf` |
| `rq-facebook-v25-input-cleared.json` (A remained) | `205820266d5528dc909d4843c0db1a96dc5fb2b19218da82c6672c327ee29f1e` |
| `rq-facebook-v25-backspace-hit.json` | `bdd8fb1cac93cea428d5dc1f5903e4786c3d35689bd695197daf61063f4925b9` |
| `rq-facebook-v25-backspace-collapsed-hit.json` | `d2cc567dc6a014ef7dacb7cfdd552a67ace7ae6ed4309f5bac195d0f0623aeb4` |
| `rq-facebook-v25-input-physical-clear.json` | `c8db8addb375ad01a1a04e7cac97ab567278ad97144feb00eb04d151d94e5d0d` |
| `rq-facebook-v25-first-quit-final.json` | `8e482ff4c707395b05501ac9aff5894d5a82b20c04b7938ecaf2e4d89f1c4b04` |
| `rq-facebook-v25-debug-off-ready.json` | `13038df23c92bab5b77a19235968ea050d0695e83a0001a5ee7d532cbcf86de8` |
| `rq-facebook-v25-debug-off-hit.json` | `ec922b3a2030ddead8c9fb91cfafcce5208da863fad7e1d6d30392c116d2babf` |
| `rq-facebook-v25-debug-off-letter.json` | `0da4521671a06fd285fb69b658b0f4d946f0c0d4aef07c9ceb2f233faf98c517` |
| `rq-facebook-v25-debug-off-clear.json` | `7a0db0deb43f82d4573962afafc3fcb80ba7d039bfccfe78a7030cf9b7b41d4c` |
| `rq-facebook-v25-second-quit-final.json` | `ec2de9b328d6f84f03746709c0a68f77578b9fd48dfa2f81e71b47526a2eae72` |
| `rq-facebook-v25-input-cleanup.json` | `ffcd6f6f009251a912bbbae3f35d492009ca2d8b6e8af6d975275aa5ce4d86f0` |
| Dashboard `rq-facebook-v25-debug-off.json` | `1ce1304ec5edf9e6189d31f7a8efb449280ffcc66bdef086bbf18bdec9af0b78` |
| Dashboard `rq-facebook-v25-debug-restored-fresh.json` | `9ccd94ff3de9cb5f01cf6cec2fc258b468a73fcf504b4f4a5d416d7e4d00e00f` |
| Official debug-tool source snapshot | `7c0bf92c634ecf25973d45be41a0af303f69554d2e65eda7398ad0114e7e254d` |

Dashboard receipts are under `/home/craig-beswetherick/.firefox-devtools-mcp/output/`. The official source snapshot is `/tmp/rq-facebook-igdebug-doc-2026-11-28.md`, fetched over HTTPS with `Accept: text/markdown` and HTTP 200. This record adds no automated-test, startup-timeout, real hidden/resume, phone, multiplayer-delivery or complete submission-acceptance claim; [local startup verification](facebook-startup-recovery-2026-11-28.md) retains its separate scope.
