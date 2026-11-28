# Inactive Facebook Settings owner cleanup — 28 November 2026

When account ownership changed during an admitted Settings action, cancellation could leave the old capability's `pendingAction` set to `quit`. Its publication helper rejected updates for inactive owners, including the final clearing update. The outer Facebook entry retains and subscribes to that capability, so its pending snapshot could keep the game inert after the child account view had unmounted.

The correction reuses idempotent retirement when an inactive capability tries to publish. It notifies subscribers with an empty, nonpending snapshot, invalidates eligibility work and prevents the former owner from becoming usable again. It does not invoke the SDK, cancel the actual save, start another flush or alter native-dialog/banner ownership. The original preparation promise retains its ordering and may finish without a late native Quit.

## Verification

- Before correction: **3 failed, 32 passed**, 35 focused Settings tests, 0.233 seconds. The failures reproduce stale pending state after save settlement, panel cancellation and deadline expiry for an inactive owner.
- After correction: **35 passed**, 0.244 seconds. Regressions verify subscriber notification, unfinished-save retention, no late native Quit/new flush, no stale eligibility publication and no resurrection when the external activity predicate later returns true.
- Shared typecheck passed.
- Complete built-entry browser journey passed: **1 test, 42.770 seconds**. The browser build/artifact audit passed with 420 runtime files, 4.51 MB total and 0.71 MB initial resources; no Jest gaming SDK, native modules or secrets leaked. Two historical fixture screenshots were restored to their exact pre-run bytes.
- Independent source/race review reported no findings. No backend source, configuration or deployment changed.

## Scope

This is a separately reproduced client cleanup defect. No account replacement was observed during the [version 18 Terms-return stall](facebook-android-terms-quit-followup-version-18-2026-11-28.md), whose native cause remains unknown. Cleanup still requires action finalization/publication to execute; this change is not a workaround for suspended callbacks or proof of native timeout recovery. Version 18 does not contain this correction. The [version 19 receipt](facebook-testing-version-19-2026-11-28.json) binds it to clean source `1abd5c9fc09e59868e5651456a5fe2abaf99e048`, bundle `29691804297082520` and archive SHA-256 `32012f0ee1f1d4476c8182e5a1320d6b4fa49c63a79e63f65f953481a4294472`. Uploaded once, the candidate passed canonical preflight and exact 420-file comparison; the Testing-only assignment returned HTTP 200 with its exact bundle ID, and canonical acceptance was recorded. The [version 19 Android check](facebook-android-version-19-2026-11-28.md) confirmed exact identity, GUITAR/1,180 restoration and normal app Quit. It did not change accounts or force a pending save, so native acceptance of the changed inactive-owner branch remains separate.

The [later version 19 timer diagnostic](facebook-android-timer-delivery-version-19-2026-11-28.md) also reproduced post-Terms pending Quit. Its matched Settings measurements found a ten-second timer completing before navigation but not within 23.954 seconds after return, while frames and microtasks continued. The inactive-owner correction remains a separate regression fix; the native cause and blocked Quit phase remain unknown.
