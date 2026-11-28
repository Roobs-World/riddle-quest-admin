# Facebook Settings warning rendering — 28 November 2026

The local correction makes Settings failure notices render when controls recover even if scheduled React work is delayed. It is uploaded as [Testing version 22](facebook-testing-version-22-2026-11-28.json). Exact-version Android checks now verify normal app Quit, the post-Terms unsaved warning and retry clearing/recovery. The post-Terms persistence operation remains unresolved. The [structured record](facebook-settings-warning-rendering-2026-11-28.json) separates local verification from the paired version 21 diagnostic.

## Local correction and proof

[PlayerSettingsActions](../../../src/settings/components/PlayerSettingsActions.tsx) retains its owner-identity check after awaiting the capability, then uses `flushSync` only for `error`, `unavailable` and `unsaved` notices. It adds no timer, SDK call or global patch. Notice state remains owned by the mounted panel. React documents synchronous DOM updates, while warning about performance, pending effects and Suspense work; this boundary is an infrequent asynchronous completion outside rendering/effects. [Official `flushSync` guidance](https://react.dev/reference/react-dom/flushSync).

The [browser regression](../../../platforms/web/facebook/scripts/verify-settings-notice-browser.mjs) builds the real component and Facebook Settings capability with an isolated fake SDK; external requests are blocked. Before correction, holding MessageChannel delivery produced `unsaved`, `pending: null`, enabled controls, zero owner aborts and no status notice. Releasing the queued task displayed the same warning without another action. The canonical red run failed in **0.830 seconds**; its tool output was verified but no red log retained. The initial reproduction survives in `/tmp/riddle-quest-settings-notice-scheduler/red-result.json` and `run.log`.

The final run passed **four scenarios in 1.136 seconds**: normal/held scheduling with retry, replacement, and unmount with late original-save completion. It verifies the translated warning, retry clearing, retained save ordering and no stale notice or Quit. Shared typecheck passed; independent review found no findings. The earlier 71 unit tests belong to the version 21 deadline correction and were **not rerun** for this notice change.

## Matched native diagnostic on version 21

After a separate startup-failed session of unknown cause, fresh launch at **04:03:24.472986 UTC** and Let’s Play at **04:04:25.689838** restored GUITAR/five empty rows/**1,180 coins**. Both following readbacks matched the exact [version 21 bundle](facebook-testing-version-21-2026-11-28.json).

| Settings observation | Start → read UTC | Elapsed | Microtask | Frame | Timer | MessageChannel |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Before Terms | 04:05:05.785 → 04:05:22.815 | 17,030 ms | 6 ms | 8 ms | 1,010 ms | 26 ms |
| After Terms | 04:07:26.718 → 04:08:00.913 | 34,195 ms | 19 ms | 21 ms | null | null |

Terms at **04:05:57.380988**, OPEN at **04:06:07.092901**, and Back at **04:06:19.969007** traversed the actual Riddle Quest Terms; cookies were untouched. Both documents were visible, but the game’s paused class changed from false to true. `setImmediate` was absent in both observations. The after-Terms receipt contains both logs; the table selects its latest payload.

Each one-shot cleaned its owned channel, timer, frame and global state before logging. No SDK call/patch or app Quit was used. Host-only Quit at **04:08:46.944743** reached Facebook main; device UI XML was removed. The earlier 04:00:59 capability list belongs to the failed-startup session.

This observes the same class of delayed task delivery reproduced locally. It does not directly inspect React state, prove an older attempt’s cause, accept the UI correction, or repair pending persistence. Firebase and provider-server code/configuration remain unchanged.

## Testing artifact

Version **22**, bundle **27134874202877022**, contains source `3d1d2e43a8dcfec2d6cd401de4200609601e9f37`. Its archive SHA-256 is `d1b55275070597cdc6478ecae7879d414bbc57eb499f5cb9f71515019a1074b6`: **2,866,590 bytes, 422 ZIP entries and 420 runtime files**. Uploaded once at **04:12:20.241 UTC**. All 420 provider-served files matched at **04:13:11.725703**, after 28 initially empty HTTP-200 responses; no source change or retransmission occurred. Testing-only assignment confirmed the exact bundle at **04:13:27.729**, and canonical acceptance was recorded at **04:14:03.869817**. No separate dashboard processing field or fresh Production assignment was read. Vercel remains version 15; no backend, Production or review action occurred.

## Version 22 Android acceptance

Two unmodified sessions ran on Galaxy S22/Android 16/Facebook 588.0.0.42.55. Rendered SDK Info verified SDK 8.0, version **22**, and `/instant-bundle/2143220529953108/27134874202877022/index.html` in each session. They advertised 47 and 48 API names respectively; only the second advertised banner load. The [receipt](facebook-testing-version-22-2026-11-28.json) retains both exact lists. No JavaScript console, probe or SDK mutation was used.

The first launch at **04:14:22.587835 UTC** restored GUITAR/five empty rows/**1,180 coins**. App Quit at **04:15:48.633470** reached **FbMainTabActivity** by **04:15:52.341448**. No gameplay progress or preference change was made, so this verifies normal exit without establishing new-save persistence.

The second launch at **04:15:58.756996** restored the same state. Terms at **04:17:17.954562**, native OPEN at **04:17:33.205934**, and Android Back at **04:17:42.884651** traversed the actual Riddle Quest Terms; cookie choices were untouched. App Quit at **04:17:45.437731** disabled Privacy/Terms/Quit. At **04:18:04.932519**, about **19.5 seconds** after the tap, the controls were enabled and the warning appeared: “Progress isn't saved yet. Keep the game open.” Fresh UI text confirmed it at **04:18:24.552731**; an ordinary scroll revealed its full text.

The first retry at **04:18:40.889471** was observed only at **04:19:18.498829**, with enabled controls and the warning; that late capture cannot establish warning clearing. A second retry at **04:19:42.839233** showed disabled controls and no warning at **04:19:45.126202**, then enabled controls and the full warning at **04:20:03.469614**, about **20.6 seconds** after the tap. These are observation times, not exact internal completion times.

This accepts the visible warning fix and retry behavior on version 22. It does not establish a completed post-Terms save or app exit. No served-banner impression, guesses, purchases, rewards, preference changes, consent changes, social sends or account cleanup were established or performed in these sessions. Host-only Quit at **04:22:35.344223** reached **FbMainTabActivity**, confirmed at **04:22:44.873580**; the temporary device UI XML was removed. Raw screenshots remain private local evidence.
