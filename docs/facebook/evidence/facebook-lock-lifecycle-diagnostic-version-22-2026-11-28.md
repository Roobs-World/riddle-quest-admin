# Version 22 lock and lifecycle diagnostic — 28 November 2026

A separate read-only Android diagnostic found that `navigator.locks.query()` completed before Terms navigation but had no observed completion **54,046 ms** into the post-Terms query. The latter lock inventory is **unknown**, not empty or confirmed blocked. A passive listener recorded a visibility-sourced resume, while the later DOM still had the paused class. This does not establish the persistence stall’s cause or accept a recovery. The [structured record](facebook-lock-lifecycle-diagnostic-version-22-2026-11-28.json) preserves bounded values and evidence hashes; raw console receipts and screenshots remain private.

## Local controls

The private command `node /tmp/riddle-quest-lock-boundary-diagnostic/run.mjs` completed four deterministic controls in **0.567 seconds** against source `0c3dd65fd7c61f25ea0da4bbab2934119d5f74b7`. It used the real lifecycle checkpoint hook, deletion gate with browser Web Locks, player projection queue, Facebook bootstrap storage, pause draining and Settings Quit capability. Only the SDK responses were faked; external requests were blocked.

| Local condition | SDK write / flush calls | Exact-name lock snapshot while waiting | Quit outcome |
| --- | ---: | --- | --- |
| Normal scheduling | 1 / 3 | Empty after completion | Success |
| Timer and MessageChannel callbacks withheld | 1 / 3 | Empty after completion | Success |
| Same primitive delays plus another page’s exclusive lock | 0 / 0 | Held exclusive; pending shared | Unsaved |
| Same primitive delays plus earlier work in the same gate | 0 / 0 | Held shared; no pending request | Unsaved |

The last two deliberately held legitimate ownership. Releasing only that blocker drained one write and three flushes while timer/MessageChannel callbacks remained withheld; neither expired attempt later called the fake SDK Quit method. These are positive diagnostic controls, not discovered product defects. No ordinary unblocked local case reproduced the native stall, and the primitive-delay comparison does not establish the native host’s task-source behavior.

## Native diagnostic and clocks

The controller recorded launch at **04:34:01.660015 UTC** and rendered SDK Info at **04:35:08.509378**: SDK **8.0**, **48 APIs**, version **22**, and `/instant-bundle/2143220529953108/27134874202877022/index.html`. This is the unchanged [Testing artifact](facebook-testing-version-22-2026-11-28.json) from source `3d1d2e43a8dcfec2d6cd401de4200609601e9f37`. Its earlier [unmodified banner observations](facebook-android-banner-version-22-2026-11-28.md) are separate acceptance evidence.

The lock observer queried without acquiring a lock. It retained only held/pending mode counts for `riddleQuest:facebookPlayerOperations:v1`, excluding client identifiers and other lock names. The bridge observer passively retained at most 16 existing host-to-game pause/resume events. Neither called or patched the SDK/storage APIs, synthesized resume, changed game state or installed timers. The records were removed and the listener detached before readback logging; pending lock callbacks check ownership and become inert after cleanup.

Controller action/extraction timestamps and device JavaScript timestamps are separate clocks. Durations below use only device timestamps; the controller times identify the UI workflow without asserting subsecond ordering across clocks. Terms was tapped at **04:39:08.538747**, OPEN at **04:39:25.328235**, and Android Back at **04:39:39.600899**. The actual external Terms page was observed.

| Device lock observation | Query start → read | Completion observed | Exact-name inventory | DOM at read |
| --- | --- | --- | --- | --- |
| Before Terms | 04:36:39.569 → 04:38:32.919 | At 04:36:39.598, **29 ms** after start | Held 0; pending 0 | Visible; not paused |
| After Terms | 04:41:03.814 → 04:41:57.860 | Unobserved at **54,046 ms**; no rejection recorded | **Unknown** | Visible; paused |

The later raw receipt also contains the old baseline log. The structured record selects the **latest** `RQ22_LOCK_READ`, after decoding its quoted JSON payload, so the baseline is not mistaken for a post-Terms result.

The passive bridge recorded these device events with **zero overflow**:

- **04:39:25.297:** `host:pause`, source `visibility`, hidden.
- **04:39:25.325:** `host:pause`, source `platform`, hidden.
- **04:39:39.461:** `host:resume`, source `visibility`, visible.

No platform-sourced resume was recorded. This does not prove the SDK callback was absent. The visibility resume was emitted on the shared bridge; it does not prove a particular subscriber ran or React committed its update. At the lock read **138.399 seconds** later, the DOM still had `.game-app.paused`. That class is rendered state, not proof that no resume signal occurred.

## Cleanup and limits

No app Quit was attempted in this diagnostic. Host X at **04:45:27.324426** opened a menu confirmed at **04:45:37.493154**; that confirmation was not an exit. The host’s blue Quit at **04:45:55.381200** exited, with fresh Facebook-main screenshot/activity confirmation at **04:46:03.434699**. Device UI XML was removed at **04:46:04.130327**. Android Back at **04:46:10.637440** dismissed an incidental main-menu surface; the activity remained **FbMainTabActivity**.

This narrows an observable boundary outside the SDK storage calls, but does not identify a held lock, missing lock grant, blocked local queue, missing SDK resume, completed save or product fix. No native storage-call trace or app-Quit result was collected here. Source, uploaded artifact, Firebase and provider-server code/configuration remained unchanged. No upload, Production promotion, publication or review submission occurred. Full journey acceptance and API coverage counts are unchanged.
