# Facebook Quit phase tracing — 28 November 2026

Testing version **20**, bundle **40287594420886203**, contains the bounded phase trace from source `185548c16aede8b57c1d957773631faf36b87e82`. The [acceptance record](facebook-testing-version-20-2026-11-28.json) binds the uploaded artifact to SHA-256 `b77f10250da577848bd44e151e547a0989b1a089900f22bba0e0b9014fe6d0a5`: 2,866,457 bytes, 422 ZIP entries and 420 runtime files. It was uploaded once and assigned only to Testing. All 420 provider-served runtime files matched on a full recheck; the initial 388/420 comparison had 32 empty HTTP-200 responses. Their cause remains unknown. Production was not promoted or freshly read; Vercel remains version 15.

## Source behavior and verification

The [trace helper](../../../platforms/web/facebook/src/engagement/FacebookQuitTrace.ts) retains at most one User Timing mark for each of ten fixed phase names under `riddle-quest:facebook:quit:`. It stores no detail payload, player data, provider identifiers or raw errors, and creates no timers, observers or SDK calls. Each admitted Quit receives a recording lease; completed, retired and superseded attempts cannot write into or clear a newer trace. A new attempt clears only the owned names. Terminal marks remain available for local readback until the next attempt or page destruction. Performance API failures are contained.

The [Settings action](../../../platforms/web/facebook/src/engagement/FacebookPlayerSettingsActions.ts) records guard admission, entry into the guarded operation, preparation, waiting for a prior preparation, the actual bound Quit call, its synchronous return and finalization. The [entry composition](../../../platforms/web/facebook/src/FacebookPlatformEntry.tsx) records progress flush and optional presence shutdown. Existing save serialization, deadlines, native-dialog ownership and SDK ordering remain unchanged.

A `projection` mark means that composition entered the persistence flush; the persistence queue or its underlying SDK request may still be pending. `invoke` means the bound Quit call was reached; `returned` does not prove Facebook exited. A mark records a reached client stage, not a provider result or the native cause. Absence of a later mark must also account for diagnostic API failure.

Focused tests passed **58/58** across two suites in **0.249 seconds**. They cover held guards, save/presence ordering, unavailable or throwing Performance APIs, bounded retention and stale attempts. Review found that an initial diagnostic expiry check hid an actual late presence transition when the timer callback was delayed. The regression failed before correction and passed after removing that check only from recording admission: after 15,001 ms without timeout delivery, presence remains observable, while later completion still returns `unsaved` and never calls native Quit. Shared typecheck, canonical preflight and the artifact audit passed. Independent review found no remaining findings. The earlier browser journey remains historical; it was not rerun for this trace-only candidate.

Logs: `/tmp/riddle-quest-quit-trace-focused-green.log`, `/tmp/riddle-quest-quit-trace-types.log`, `/tmp/riddle-quest-quit-trace-suspended-timer-red.log`, and `/tmp/riddle-quest-facebook-quit-trace-preflight.log`.

## Android observation

The single-account session used the connected Galaxy S22 (SM-S901U), Android 16/API 36 and Facebook 588.0.0.42.55. Launch began at **03:20:48 UTC**. SDK Info at **03:24:31.501982** confirmed version 20 and the exact bundle path, SDK 8.0 and 48 advertised APIs including banner loading. Dismissing the welcome at **03:24:33.951** restored the GUITAR clue, five empty rows and **1180 coins**. A real native banner appeared below Settings; its advertiser action was untouched.

Terms of Use was tapped at **03:24:52.506**, followed by Facebook's **OPEN LINK** at **03:25:00.403**. The native browser displayed Riddle Quest Terms of Service on roobsworld.com; cookie preferences were untouched. Android Back at **03:25:16** returned to Settings. App Quit was tapped at **03:25:19.305878**. At **03:25:40**, Settings actions remained disabled and the game activity was still present.

Only after that stalled attempt was IGDebug's JS Console opened. A byte-verified read-only command returned the bounded trace at **03:26:23.273**, approximately **64 seconds** after the tap. The exact bundle path matched, the document was visible, the game did not have its `paused` class and the Quit row had `aria-busy=true`.

| Recorded phase | User Timing start time (ms) |
| --- | ---: |
| `guard` | 268781.900 |
| `operation` | 268796.800 |
| `preparation` | 268797.300 |
| `projection` | 268797.500 |

The trace positively passed the dialog guards in approximately **14.9 ms**, armed the existing preparation timeout/listeners and entered `await playerPersistence.flush()`. It rules out an ongoing pre-operation dialog/banner guard wait for this attempt. No later presence, native invocation, synchronous return, finalization or retirement mark was recorded. The latest recorded boundary is the projection flush; this does **not** identify which internal persistence queue, data operation or SDK flush is pending, establish a backend failure or show that the timeout callback ran. The game did not demonstrate app-Quit recovery.

The reader called no SDK API, added no timers or wrappers and made no persistent or runtime-state writes. SDK Info was the only debug view used before Quit. The [version 19 controlled timer diagnosis](facebook-android-timer-delivery-version-19-2026-11-28.md) remains historical; timer delivery was not separately probed in version 20. The trace is diagnostic evidence, not a fix or full native acceptance.

Facebook's host exit menu and host Quit were used at **03:27:09**, with `FbMainTabActivity` then confirmed. The device UI XML was removed. This host exit is not app-Quit recovery. No guesses, purchases, rewards, social sends, notification consent or preference changes were made in this session. The pure reader left no diagnostic callbacks or global state to cancel.

Safe local records: `/tmp/riddle-quest-v20-native-sdk-info.json`, `/tmp/riddle-quest-v20-quit-trace-result.json`. The public acceptance record contains their bounded result; the original private canonical acceptance file remains unchanged.
