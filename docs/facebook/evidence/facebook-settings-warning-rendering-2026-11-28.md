# Facebook Settings warning rendering — 28 November 2026

The local correction makes Settings failure notices render when controls recover even if scheduled React work is delayed. It has **not yet been uploaded or accepted on the native host**. The [structured record](facebook-settings-warning-rendering-2026-11-28.json) separates local verification from the paired version 21 diagnostic.

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
