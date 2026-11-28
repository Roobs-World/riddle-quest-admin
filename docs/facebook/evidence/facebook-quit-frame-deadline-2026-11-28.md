# Facebook Quit deadline when timers stall — 28 November 2026

The [version 19 controlled timer history](facebook-android-timer-delivery-version-19-2026-11-28.md), [native phase trace](facebook-quit-phase-tracing-2026-11-28.md) and [separate storage diagnostic](facebook-storage-boundary-diagnostic-version-20-2026-11-28.md) showed a remaining recovery problem: after Terms OPEN/Back, Quit could remain busy past its 15-second preparation deadline. The earlier controlled check delivered animation frames while its ten-second timer remained undelivered. This correction uses that still-delivered browser signal to enforce the existing deadline; it does not identify or repair the pending persistence operation.

## Correction and boundaries

[FacebookPlayerSettingsActions](../../../platforms/web/facebook/src/engagement/FacebookPlayerSettingsActions.ts) now schedules a local animation-frame check while Quit preparation is pending, alongside the existing timer. A delivered frame compares the existing absolute deadline and returns the existing unsaved-progress result when expired. Terminal settlement cancels the outstanding frame, including handle zero. Stale callbacks cannot reschedule or affect later attempts. Missing or throwing frame APIs retain timer/abort recovery. No frame work starts while the native-dialog guard is still pending.

Actual saves remain alive and ordered. Retry first waits for the earlier preparation, then flushes fresh progress within its own deadline. Expired or retired attempts cannot call native Quit later. No global timer, SDK, Firebase or provider-server behavior changes. If neither timers nor animation frames are delivered, this check cannot guarantee visible recovery.

## Local evidence

The regression first failed with `pending` instead of `unsaved`. With timer delivery withheld, a frame at 14,999 ms preserves pending state; a frame at 15,000 ms yields unsaved and restores controls. The same test verifies the original save survives, retry waits, fresh saving completes before exactly one native Quit, and no late Quit occurs. Additional cases cover success/failure/abort/retirement, stale callbacks, missing and throwing frame APIs and held native guards.

**71/71 focused tests** across Settings actions and the bounded trace passed in **0.260 seconds**. Shared typecheck and diff checks passed. Independent read-only review found no findings. Logs: `/tmp/riddle-quest-quit-frame-red.log`, `/tmp/riddle-quest-quit-frame-focused-green.log`, `/tmp/riddle-quest-quit-frame-types.log`.

## Artifact and native scope

Testing **version 21**, bundle **29704189249216997**, contains this correction from source `e5ac3209919b11899082e916e3f805953da41977`. The [exact acceptance record](facebook-testing-version-21-2026-11-28.json) binds it to SHA-256 `6c71b820f8686c59104a7d16f8678513ec7e9e2dfb5a6fe6654af64f85fd6ab4`: 2,866,568 bytes, 422 ZIP entries and 420 runtime files. Canonical preflight and the artifact audit passed. Uploaded once at 03:46:00.938 UTC; all 420 served runtime files matched at 03:47:15.793734, following 12 initially empty HTTP-200 bodies. No source change or retransmission occurred. Testing-only assignment confirmed the exact bundle at 03:47:41.468; canonical acceptance was recorded at 03:48:01.826961.

The earlier full browser journey was not rerun. No Production promotion, publication, review submission, Vercel deployment or Firebase change is part of this correction.

## Android observation

The single-account Galaxy S22 session began at **03:48:11 UTC**. SDK Info at **03:49:36.167848** confirmed version 21, its exact bundle path, SDK 8.0 and 48 APIs including banner loading. Let’s Play at **03:49:38.542414** restored GUITAR, five empty rows and **1,180 coins**. A native banner appeared below Settings without advertiser interaction. Terms at **03:49:59.290825** → OPEN at **03:50:01.668032** displayed Riddle Quest Terms on roobsworld.com; cookies were untouched. Android Back at **03:50:34** returned to Settings.

App Quit at **03:50:36.670804** disabled the actions. They remained disabled in the 03:50:44 screenshot, then were enabled by 03:51:02, approximately 25 seconds after the tap. A fresh UI dump at **03:51:16.096202** confirmed enabled Privacy, Terms and Quit actions. No unsaved-progress notice was visible. Retry Quit at **03:51:54.252261** also restored enabled actions by the 03:52:34 observation, again without a visible notice or native exit. Neither attempt used console commands, SDK wrappers or runtime mutation before its outcome.

Only after both observations, a read-only DOM and bounded-trace command ran at **03:56:13.338** and was extracted at **03:56:27.344103**. It confirmed the exact bundle, visible/unpaused game, no busy Settings rows, and no DOM elements matching `[role="status"],[role="alert"]`. The latest retry retained these marks:

| Phase | User Timing start time (ms) |
| --- | ---: |
| `guard` | 221015.500 |
| `operation` | 221019.600 |
| `preparation` | 221019.600 |
| `previous-preparation` | 221019.700 |
| `finished` | 236037.400 |

The retry finalized approximately **15,017.8 ms** after entering preparation, with its latest wait at the previous preparation. This supports bounded control recovery while the earlier save remains outstanding; it does not prove save completion or native Quit. No invocation or return mark was recorded. The first attempt’s trace was replaced by the retry, so its precise deadline timing is not established. The missing notice remains unresolved: source inspection found no pending-state-driven Settings remount, but enabled external-store controls do not prove that the later local React notice update committed. No scheduler cause is established.

The reader called no SDK API and added no timers, wrappers or persistent/runtime-state writes. Host Quit at **03:57:05.482680** reached `FbMainTabActivity`; temporary device UI XML was removed. That cleanup is not app-Quit success. No guesses, purchases, rewards, social sends, consent or preference changes were made. Safe local records are `/tmp/riddle-quest-v21-native-sdk-info.json`, `/tmp/riddle-quest-v21-deadline-ui-result.json` and `/tmp/riddle-quest-v21-deadline-read-result.json`; the public receipt includes the bounded trace. The immutable private canonical acceptance record remains unchanged.
