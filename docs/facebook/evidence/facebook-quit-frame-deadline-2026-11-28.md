# Facebook Quit deadline when timers stall — 28 November 2026

Version 20’s [controlled timer history](facebook-android-timer-delivery-version-19-2026-11-28.md), [native phase trace](facebook-quit-phase-tracing-2026-11-28.md) and [separate storage diagnostic](facebook-storage-boundary-diagnostic-version-20-2026-11-28.md) showed a remaining recovery problem: after Terms OPEN/Back, Quit could remain busy past its 15-second preparation deadline. The earlier controlled check delivered animation frames while its ten-second timer remained undelivered. This correction uses that still-delivered browser signal to enforce the existing deadline; it does not identify or repair the pending persistence operation.

## Correction and boundaries

[FacebookPlayerSettingsActions](../../../platforms/web/facebook/src/engagement/FacebookPlayerSettingsActions.ts) now schedules a local animation-frame check while Quit preparation is pending, alongside the existing timer. A delivered frame compares the existing absolute deadline and returns the existing unsaved-progress result when expired. Terminal settlement cancels the outstanding frame, including handle zero. Stale callbacks cannot reschedule or affect later attempts. Missing or throwing frame APIs retain timer/abort recovery. No frame work starts while the native-dialog guard is still pending.

Actual saves remain alive and ordered. Retry first waits for the earlier preparation, then flushes fresh progress within its own deadline. Expired or retired attempts cannot call native Quit later. No global timer, SDK, Firebase or provider-server behavior changes. If neither timers nor animation frames are delivered, this check cannot guarantee visible recovery.

## Local evidence

The regression first failed with `pending` instead of `unsaved`. With timer delivery withheld, a frame at 14,999 ms preserves pending state; a frame at 15,000 ms yields unsaved and restores controls. The same test verifies the original save survives, retry waits, fresh saving completes before exactly one native Quit, and no late Quit occurs. Additional cases cover success/failure/abort/retirement, stale callbacks, missing and throwing frame APIs and held native guards.

**71/71 focused tests** across Settings actions and the bounded trace passed in **0.260 seconds**. Shared typecheck and diff checks passed. Independent read-only review found no findings. Logs: `/tmp/riddle-quest-quit-frame-red.log`, `/tmp/riddle-quest-quit-frame-focused-green.log`, `/tmp/riddle-quest-quit-frame-types.log`.

## Artifact and native scope

The correction has not yet been uploaded or verified on the native host. Testing version 20 remains the previous artifact until a new exact-source receipt is recorded. No Production promotion, publication or review submission is part of this correction.
