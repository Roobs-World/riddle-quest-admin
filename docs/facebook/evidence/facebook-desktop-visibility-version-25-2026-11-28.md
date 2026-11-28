# Version 25 desktop visibility observation — 28 November 2026

**The user reported completing minimize/restore, and subsequent input worked. The recorder captured trusted focus/blur events but no hidden state, visibility-change event or paused game root. Native hidden/resume acceptance therefore remains unverified.** This does not imply that the user failed to perform the requested action or identify why the expected visibility transition was absent.

The observed iframe path identified unchanged [Testing version 25](facebook-testing-version-25-2026-11-28.json), bundle `30120031574249440`. The [earlier desktop input check](facebook-desktop-input-version-25-2026-11-28.md) retains its separate developer-overlay findings.

## Observed sequence

- At **11:08:32.314 UTC**, gameplay showed the PEACOCK riddle, 1,610 coins and empty answer cells. A temporary recorder attached document-visibility and focus/blur listeners plus a game-root class observer. It retained at most 40 records and made no SDK mutation.
- Intermediate snapshots at 11:31:42.634, 11:34:32.231 and 12:08:27.605 showed the same game with the recorder present. After the user's completion report, the **12:15:26.093** snapshot still contained only trusted focus/blur transitions after the initial sample; every sample reported `visibility:"visible"`, `hidden:false` and `paused:false`. No visibility-change or paused-root event appeared.
- Bounded direct browser-control connection attempts timed out after six and twenty seconds without obtaining window metadata or issuing a window mutation. These attempts do not establish that native window control is universally unavailable, nor do they explain the missing visibility event.
- At **12:16:13.785**, the onscreen A key entered the first answer cell. By **12:16:14.333**, physical Backspace left all 35 cells empty, with the PEACOCK riddle, 1,610 coins, no notice and an unpaused game. This proves subsequent input responsiveness, not recovery from a recorded pause.
- At **12:16:27.630**, the stop receipt confirmed the recorder, listeners and observer were removed. Its final event list likewise contained no hidden, visibility-change or paused-root transition.
- Final normal Quit reached `/gaming/play/` at **12:18:59.996**, with only `/maw_proxy_page/` remaining. The owned Chrome game tab closed at **12:19:06**. The **12:20:07.272943** cleanup receipt confirms recorder removal, removal of temporary connection metadata/script files, preserved pre-existing tabs and no pending manual action.

A separate local code inspection found that installed Chrome MCP **1.14.0** requests focus emulation before page-scoped tools and `evaluate_script` (`McpPage.js:329` and `tools/script.js:170`), with no public focus-disable option found. The private inspection manifest records the installed package version and source-file digests. The running package was not conclusively matched to that installation, and actual protocol activation was not observed. This is a possible measurement limitation, **not an established cause** of the missing hidden event.

No answer was submitted, reward earned, notification sent or consent changed. No application source, new upload, Firebase/provider code or configuration changed. No screenshot, personal Facebook UI or browser-control endpoint identifier is included here. This observation does not complete the lifecycle or submission matrix.

## Private evidence

The following files remain in `/tmp/`; hashes bind the narrow observations without publishing browser-session material. Intermediate snapshots listed above remain private supporting records; the final event list preserves their observed events.

| Receipt | SHA-256 |
| --- | --- |
| `rq-facebook-v25-visibility-start.json` | `29852575874623b60b4ca26fd8a34f55bc632d2a24f97c8e735efa3b906a027f` |
| `rq-facebook-v25-visibility-done.json` | `21ee5b3bd796a7b5ce5d9e361b4591e28d9cd292df87733b77a046fd124dec31` |
| `rq-facebook-v25-visibility-input-letter.json` | `355a9e43b99d774654fb46c6efbbcc80b56942bd396313a411a86c1e27c43509` |
| `rq-facebook-v25-visibility-input-clear.json` | `dee89a55e4fb98b9ea403b83b7d8587e500e0ff117383d46901f416d6ed20cc5` |
| `rq-facebook-v25-visibility-stopped.json` | `39e36212515a240df4905108c587e33e4735b2330f1a98f1075e39a4ae5aa704` |
| `rq-facebook-v25-visibility-quit-final.json` | `b302259486c13682d3815d103f41a677fe283885a4286dbb7ad160c7da097d50` |
| `rq-facebook-v25-visibility-cleanup.json` | `ef711c562fcba4cc56970edc4b05aa71fe66bdb85cad3847f74f8edcd1b58b66` |
| `rq-facebook-v25-focus-emulation-inspection.json` | `767c7bd733df44c2690ab931c2b07380a43cfd629c6a88cf9e9b3fe7306e8225` |
