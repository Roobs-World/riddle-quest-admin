# Version 22 Android gate-stage diagnostic — 28 November 2026

After Terms/Back and one **Quit game** attempt, source markers reached the shared-lock request callsite, with no later guarded-entry or release marker during a **46.876-second controller observation window**. Current queue snapshots again showed pending projection/gate tails and a fulfilled storage tail. This narrows the observed boundary beyond the [previous queue diagnostic](facebook-android-save-queue-diagnostic-version-22-2026-11-28.md), but **does not establish a held lock, native grant, exact instance/caller, root cause or fix**. The [structured record](facebook-android-gate-stage-diagnostic-version-22-2026-11-28.json) preserves the stage events, bounded queue snapshots and 16 private-evidence hashes.

## Instrument and candidate

The fresh Android launch at **06:22:55.734436 UTC** ran [Testing version 22](facebook-testing-version-22-2026-11-28.json), path `/instant-bundle/2143220529953108/27134874202877022/index.html`. The loaded `assets/facebook-CYtZ0fO9.js` matched the local artifact: **396,415 bytes**, SHA256 `e8dc4ce8f946e358a35bfc5931c7f90e4283de00d4f2c8480b80d460cf5acb31`. No fresh SDK version or API inventory was read.

Five temporary conditional source breakpoints were selected from reviewed UTF-16 source windows through `getPossibleBreakpoints`; each installed `actualLocation` matched exactly. Installed at **06:30:36.319**, their always-false conditions emitted only a fixed prefix, fixed stage and device `Date.now()`: **gate-admitted → after-previous → shared-request → guarded-entry → gate-release**. They covered **all instances executing those source locations**, without gate/caller identity filtering. They did not call SDK, storage or lock methods, patch the SDK, install application globals/timers, or capture arguments, epochs or account data.

Separate V2 queue snapshots selected the current React-owned instances and read existing promise states and bounded flags. All recorded tail/owner/current-owner comparisons passed; these reads remain sequential rather than atomic. The harness recorded **zero unexpected pauses, overflow or detected issues**, but instrumentation can still affect scheduling. This is diagnostic evidence, not uninterrupted native acceptance.

## Baseline and Terms

Gameplay remained **PANDA/five empty rows/1,310 coins**. Sound was changed **On → Off → On**, confirmed in fresh UI receipts at **06:31:39.002087** and **06:31:53.705715**. Reduced Motion and Notifications remained Off; analytics consent was unchanged. Each Sound change was accompanied by a complete five-stage sequence, establishing functioning baseline logging. An earlier exact-label lookup failed without input; the misleadingly named `sound-off.png` still showed On and is excluded as evidence of the confirmed change.

Terms was tapped at **06:32:06.409797**. The immediate screenshot still showed a pending spinner; the actual native confirmation was observed separately at **06:32:15.904058**. **OPEN LINK** at **06:32:24.929487** was followed by another complete five-stage sequence and the Terms page at **06:32:26.178803**. Android Back at **06:32:34.326974** returned to Settings. The three complete sequences had request-callsite-to-guarded-entry intervals of **10, 17 and 13 ms**, computed solely from device timestamps. Their temporal association with these UI actions does not prove caller identity.

## Quit and observed boundary

One app **Quit game** tap at **06:32:46.842249** was followed by markers **16–18: admitted, after-previous, shared-request**, all received by the controller at **06:32:46.873**. No subsequent guarded-entry or gate-release marker appeared through the final snapshot ending **06:33:33.749**. The **46.876 seconds** measures controller receipt to final snapshot end, not device-clock time or cleanup duration.

| Current-instance snapshot | UTC read window | Projection / gate / storage | Outstanding | DOM paused |
|---|---|---|---:|---|
| Sound restored | 06:31:53.752–53.827 | fulfilled / fulfilled / fulfilled | 0 | false |
| After Back | 06:32:35.748–35.850 | fulfilled / fulfilled / fulfilled | 0 | true |
| After Quit | 06:32:46.894–47.042 | pending / pending / fulfilled | 2 | false |
| Warning visible | 06:33:19.364–19.472 | pending / pending / fulfilled | 3 | false |

Both dirty flags remained false; projection/gate were accepting and the cross-context lock was present and required. The warning **“Progress isn't saved yet. Keep the game open.”** appeared by **06:33:07.309784**, and enabled Terms, Privacy and app Quit controls were confirmed at **06:33:19.314230**. No retry occurred.

The source trace places the observed interruption after the previous-tail wait and at the **shared-request callsite through guarded-callback-entry boundary**. A callsite marker does not trace native invocation return or grant. The events are not identity-bound to the sampled queues, and neither outstanding **2 → 3** nor the paused **true → false** transition identifies a caller or cause. `flush()` itself does not acquire the operation gate; an accepted update or another gated operation can be ahead of it. Conditions suppress logging errors: the working baseline supports the observer, but absent later markers are not categorical proof that a callback never executed. No native storage-call trace was captured.

## Cleanup and limits

By **06:33:33.788**, all five breakpoints were removed, Debugger and Runtime disabled, and the diagnostic WebSocket closed. Host Quit at **06:33:48.663119** returned to Facebook's main activity by **06:33:59.725126**. Cleanup at **06:34:00.362148** confirmed `FbMainTabActivity`, temporary UI XML and owned ADB-forward removal, and zero live CDP sessions. **Host exit was cleanup, not save recovery.** Sound was restored to On before navigation; no gameplay changes, consent changes or later relaunch acceptance occurred.

Source, Testing artifact, Firebase and provider-server configuration remained unchanged. No automated tests, build/upload, social send, purchase, destructive account cleanup, production promotion, publication or review submission occurred. API coverage and acceptance counts remain unchanged. Raw images and device/account/frame/context identifiers remain private.

## Next diagnostic, not yet performed

The subsequent [access check](facebook-native-debug-access-version-22-2026-11-28.md) found that Facebook's original Android process and debug socket had disappeared. Its replacement ran the exact Testing candidate but exposed no debug endpoint. The worker harness was prepared and reviewed; no worker was created and no query ran. This is an access limitation, not a worker/CSP failure or a lock-inventory result.

Evaluate a temporary Worker in the same storage bucket, with a successful pre-Terms query baseline and results read through its own CDP target. The specification [shares a lock manager across that bucket's pages and workers](https://www.w3.org/TR/web-locks/#lock-managers) and [adds a granted lock to the held set before queuing its callback](https://www.w3.org/TR/web-locks/#process-a-lock-request-queue). An exact-name, aggregate-only query could help distinguish contention from callback delivery without acquiring or releasing locks. Worker/CSP/CDP support and bucket identity must first be established; a worker may also be suspended, and aggregate counts cannot identify this particular request. No policy relaxation or forced resume is justified. Terminate the worker and revoke its Blob URL after any future diagnostic.
