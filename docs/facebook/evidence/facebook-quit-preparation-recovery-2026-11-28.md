# Facebook Quit preparation recovery — 28 November 2026

The [version 17 Android check](facebook-android-version-17-2026-11-28.md) exposed a Settings Quit action that remained pending for more than four minutes. Its actual stalled operation was not identified. Read-only source tracing found a separate, reproducible client recovery gap: Quit waits for progress persistence and presence cleanup without a deadline. An unresolved preparation promise leaves the Settings actions disabled indefinitely.

The correction bounds only that preparation wait to 15 seconds. It uses the existing translated unsaved-progress outcome, restores Settings admission, and never invokes native Quit after an expired or cancelled attempt. A wall-clock check also rejects a late completion delivered before a delayed timer callback. Native-dialog and banner guards retain their existing ownership and are not covered by this timeout.

The underlying preparation promise remains alive and retains its storage ordering. A retry waits for that outstanding work, then performs a fresh flush for newer progress within its own deadline. Expired, aborted or retired attempts cannot enqueue another flush or quit later. No persistence queue, deletion gate, Firebase source/configuration or provider-server module changed.

## Verification

- Focused Settings regressions first failed: **6 failed, 27 passed**, 33 total, 0.236 seconds.
- After correction: **33 passed**, 0.209 seconds. Cases cover never-settling preparation, late completion, fresh retry after outstanding work, expired retry, panel cancellation, account retirement, delayed timers and retained banner admission.
- Shared TypeScript check passed.
- The complete built-entry browser journey passed in **42.739 seconds**. Its build/artifact audit covered 420 runtime files, 4.51 MB total and 0.71 MB initial resources, with no Jest gaming SDK, native-module or secret leakage. Two overwritten historical fixture screenshots were restored to their exact pre-run bytes.
- Independent specification/race review and standards/safety review both reported no findings.

Private logs: `/tmp/riddle-quest-facebook-quit-preparation-red.log`, `/tmp/riddle-quest-facebook-quit-preparation-green.log`, `/tmp/riddle-quest-facebook-quit-preparation-types.log`, and `/tmp/riddle-quest-facebook-quit-recovery-browser.log`.

## Limits

This correction is not present in Testing version 17. A separate clean artifact, Testing upload and exact-version native check are required. It improves recovery while JavaScript executes; it cannot restore controls while the host suspends JavaScript timers and callbacks. It does not resolve the underlying external-navigation incident or prove native save/flush health. The actual save remains protected rather than being treated as completed after timeout.

No production promotion, review submission, publication, backend deployment or hosted GitHub runner was used.
