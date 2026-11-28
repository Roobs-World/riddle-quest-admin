# Facebook Quit preparation recovery — 28 November 2026

The [version 17 Android check](facebook-android-version-17-2026-11-28.md) exposed a Settings Quit action that remained pending for more than four minutes. Its actual stalled operation was not identified. Read-only source tracing found a separate, reproducible client recovery gap: Quit waits for progress persistence and presence cleanup without a deadline. An unresolved preparation promise leaves the Settings actions disabled indefinitely.

The correction bounds only that preparation wait to 15 seconds. It uses the existing translated unsaved-progress outcome, restores Settings admission, and never invokes native Quit after an expired or cancelled attempt. A wall-clock check also rejects a late completion delivered before a delayed timer callback. Native-dialog and banner guards retain their existing ownership and are not covered by this timeout.

The underlying preparation promise remains alive and retains its storage ordering. A retry waits for that outstanding work, then performs a fresh flush for newer progress within its own deadline. Expired, aborted or retired attempts cannot enqueue another flush or quit later. No persistence queue, deletion gate, Firebase source/configuration or provider-server module changed.

## Verification

- Focused Settings regressions first failed: **6 failed, 27 passed**, 33 total, 0.236 seconds.
- After correction: **33 passed**, 0.209 seconds. Cases cover never-settling preparation, late completion, fresh retry after outstanding work, expired retry, panel cancellation, account retirement, delayed timers and retained banner admission.
- Shared TypeScript check and canonical upload preflight passed.
- The complete built-entry browser journey passed in **42.739 seconds**. Its build/artifact audit covered 420 runtime files, 4.51 MB total and 0.71 MB initial resources, with no Jest gaming SDK, native-module or secret leakage. Two overwritten historical fixture screenshots were restored to their exact pre-run bytes.
- Independent specification/race review and standards/safety review both reported no findings.

Private logs: `/tmp/riddle-quest-facebook-quit-preparation-red.log`, `/tmp/riddle-quest-facebook-quit-preparation-green.log`, `/tmp/riddle-quest-facebook-quit-preparation-types.log`, and `/tmp/riddle-quest-facebook-quit-recovery-browser.log`.

## Limits

This correction is included in [Testing version 18](facebook-testing-version-18-2026-11-28.json), bundle `29215929211369652`, from clean source `543c5791aa7e76345fb1b20906700bb0a629d188`. The archive was uploaded once and assigned to Testing; all 420 runtime files matched on the first provider comparison. The [version 18 Android check](facebook-android-version-18-2026-11-28.md) rendered its exact SDK Info identity, restored PENCIL with 1,155 coins and exited through normal Settings Quit at 01:49:42–01:49:44 UTC. A second Quit five seconds after changing Reduced motion to On exited normally, and relaunch visibly restored On. A final exact-version-18 relaunch confirmed restored Off at 02:00:10 UTC with PENCIL/1,155 coins preserved. Final normal Quit at 02:00:39 reached Facebook main by 02:00:41; the phone was left outside the game with no active debug panel or diagnostic callback. Native Invite and Play with friends opened and cancelled without a recipient selection or send. These ordinary exits, save persistence and cancellations are narrow host results, not forced stalled-save or deadline tests.

Between the second and final normal exits, Terms OPEN LINK/Android Back returned to Settings, but the Quit tap at 01:54:34 UTC left actions grey through 01:55:27, at least 53 seconds, without an observed unsaved-progress notice. No DOM busy-action inspection established whether Quit was admitted, Terms retained ownership or banner preparation was pending. A separate read-only scheduler probe at 01:56:11 reported visible/exact-version-18 state and an 11 ms microtask; its animation-frame callback and ten-second timer had produced no visible output by 01:56:22. The next DOM probe was not submitted because Facebook Home was already visible in the 01:56:56 UI dump. The exact exit time and cause were not observed. This remains failed/inconclusive native recovery evidence, not a 15-second timeout pass or a fix for the post-navigation stall.

Version 17 remains the historical reproduction and does not contain this correction. The timeout behavior remains controlled local proof. The correction improves recovery while JavaScript executes; it cannot restore controls while the host suspends JavaScript timers and callbacks, and the native scheduler observation does not prove host-wide suspension. Native-dialog ownership and banner preparation remain outside this deadline. The actual save remains protected rather than being treated as completed after timeout. No underlying native cause has been identified.

No production promotion, review submission, publication, backend deployment or hosted GitHub runner was used.
