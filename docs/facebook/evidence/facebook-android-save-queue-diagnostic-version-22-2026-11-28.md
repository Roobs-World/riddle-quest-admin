# Version 22 Android save-queue diagnostic — 28 November 2026

After returning from Terms, all three observed save-related queue tails were fulfilled. After one **Quit game** attempt, the projection and account-operation gate tails were pending while the storage tail remained fulfilled. This narrows the observed wait but **does not establish a held lock, exact blocked caller or fix**. The [structured record](facebook-android-save-queue-diagnostic-version-22-2026-11-28.json) contains bounded snapshots and 16 private-evidence hashes.

## Candidate and method

A fresh launch at **06:02:54.079494 UTC** exposed the Android Facebook WebView's CDP target through a temporary ADB forward. The target list had been empty outside the game. At **06:04:19.767**, the actual game execution context showed **Riddle Quest** at `/instant-bundle/2143220529953108/27134874202877022/index.html`, matching [Testing version 22](facebook-testing-version-22-2026-11-28.json). There was no fresh SDK version or supported-API inventory read in this phase. Gameplay showed **PANDA/five empty rows/1,310 coins**; no guesses, rewards, preferences or consent changes were made.

The temporary observer selected a unique structural hook-ref match from the current React tree and inspected existing `projection.pending`, `operationGate.tail` and `storage.operationTail` promises through CDP `[[PromiseState]]`. It retained bounded flags and identity comparisons, not player state, preferences, epoch values, promise results or SDK payloads. It invoked no SDK, storage or lock methods, installed no listeners/timers and used no debugger pause or breakpoint. Object-group release was attempted in `finally`, and each WebSocket closed after its snapshot.

The first two snapshots used **V1**, which recorded a final timestamp and equality of captured tail/owner references. **V2** additionally recorded the read window, required a unique default execution context, used bounded cycle-aware traversal with cap rejection, and reselected the current React owner after reading. Every recorded equality check passed. The reads remain sequential, **not atomic**, and possible CDP scheduling interference prevents treating this as uninterrupted native acceptance. Raw target URLs, query strings, context/frame identifiers and screenshots remain private.

## Observations

Terms was tapped at **06:08:41.240396**. V2 rebaselined while the native confirmation was open, before **OPEN LINK** at **06:10:57.116095**. The actual Terms page appeared at **06:11:02.738253**; Android Back at **06:11:14.099401** returned to Settings by **06:11:21.158971**. One app **Quit game** tap followed at **06:11:33.786821**.

All times below are UTC. “Projection / gate / storage” are the existing queue-tail states. Both dirty flags stayed false; projection and gate remained accepting; the cross-context lock was present and required; document visibility was visible throughout these snapshots.

| Snapshot | Observer/read time | Projection / gate / storage | Outstanding | DOM paused |
|---|---|---|---:|---|
| Before Terms, welcome open | V1 final 06:07:16.145 | fulfilled / fulfilled / fulfilled | 0 | false |
| Settings baseline | V1 final 06:08:24.178 | fulfilled / fulfilled / fulfilled | 0 | false |
| Before OPEN LINK | V2 06:10:46.594–46.679 | fulfilled / fulfilled / fulfilled | 0 | false |
| After Back, before Quit | V2 06:11:21.548–21.647 | fulfilled / fulfilled / fulfilled | 0 | true |
| After Quit, initial | V2 06:11:33.840–34.000 | pending / pending / fulfilled | 2 | false |
| Later after Quit | V2 06:12:05.542–05.613 | pending / pending / fulfilled | 3 | false |
| Warning visible | V2 06:13:27.863–27.966 | pending / pending / fulfilled | 3 | false |

At **06:12:55.888229**, Settings showed **“Progress isn't saved yet. Keep the game open.”** A fresh UI receipt at **06:12:58.634914** confirmed that warning and enabled Terms, Privacy and app Quit controls. No second app Quit was attempted.

## Interpretation and cleanup

The wait arose after the sampled post-Back/pre-Quit state. A new checkpoint could have been admitted between that snapshot and the tap; these observations do not identify its caller. Pending projection/gate tails with a fulfilled storage tail narrow the observed wait to work before storage or an unfinished gate lifetime, without proving native lock contention.

[`PlayerProjectionPersistence.flush()`](../../../src/accounts/browser/playerState/PlayerProjectionPersistence.ts) enqueues work but does not acquire the operation gate. Updates and retries enter that gate. The pending gate can therefore belong to an accepted update or another shared gated operation ahead of the flush; it is not evidence that Quit's flush directly acquired a lock. False dirty flags are consistent with waiting before a guarded update merges, not proof that no write was accepted. Outstanding **2 → 3** identifies another accepted queue position, not its caller. The observed paused **true → false** transition was not traced or diagnosed. The three exposed promises are queue tails/barriers, not named references to the native lock request or guarded callback.

Normal app Quit did not exit or establish a successful save. The host menu opened at **06:13:27.994560**, followed by host Quit at **06:13:40.964570**. Facebook's main activity was visible at **06:14:03.773473**. Cleanup at **06:14:04.472154** confirmed `FbMainTabActivity`, removal of the temporary device UI XML and owned ADB forward, and zero live CDP sessions. **Host exit was cleanup, not save recovery.** No subsequent relaunch acceptance was performed in this phase.

Source, Testing artifact, Firebase and provider-server configuration remained unchanged. No automated tests, new build/upload, social send, purchase, destructive account cleanup, production promotion, publication or review submission occurred. No native storage-call trace or root cause was established, and API coverage/acceptance counts remain unchanged.
