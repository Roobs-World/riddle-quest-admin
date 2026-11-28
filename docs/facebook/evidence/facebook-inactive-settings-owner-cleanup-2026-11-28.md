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

This is a separately reproduced client cleanup defect. No account replacement was observed during the [version 18 Terms-return stall](facebook-android-terms-quit-followup-version-18-2026-11-28.md), whose native cause remains unknown. Cleanup still requires action finalization/publication to execute; this change is not a workaround for suspended callbacks or proof of native timeout recovery. Version 18 does not contain this correction. A new immutable candidate and its own host checks are required before claiming uploaded acceptance.
