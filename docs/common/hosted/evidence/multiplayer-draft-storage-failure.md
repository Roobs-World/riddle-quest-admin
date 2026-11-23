# Multiplayer draft preservation when storage reads fail

A failed raw draft read was previously converted to `null`, the same value as an observed empty key. A resumed session could therefore write new letters over an unreadable saved draft. An older session that had observed an empty key and failed its initial write could also replace another tab's later successful draft after losing read access.

Two public-session tests reproduced both overwrites with otherwise valid canonical race responses. A real browser harness reproduced the first failure by denying only `Storage.getItem` for the draft key after reload while allowing writes. The original `P`, `I` draft was replaced by `C`, `L`. The browser negative run substituted the exact prior draft module, whose SHA-256 matches the previous focused verification record; it did not alter canonical race behavior or the browser fault fixture.

`observeBrowserStorage` now distinguishes a successful empty-key observation (`null`) from unavailable storage (`undefined`). Existing preference callers keep their defensive empty fallback through `readBrowserStorage`. The draft module uses the observation result directly and refuses to bind or write when it cannot observe the revision. Throws from injected raw adapters also remain unavailable. The player can keep typing and accepting authoritative responses while cached bytes remain protected. Optional storage failure never authorizes cleanup of another tab's record.

## Evidence

- `artifacts/race-draft-storage-failure/unit-before.log`: two newly added cases failed with saved draft replacement; the previous 41 draft cases passed. `unit-after.log`: all 43 cases pass.
- `browser-before.log`: exact prior module failed the unreadable-record preservation assertion after genuine keyboard input and reload. `prior-draft-storage.ts` is retained under artifacts for that negative fixture.
- `browser-after.log`: eight desktop/mobile creator/challenger scenarios cover normal reload and denied reads. Canonical run and start schedule remain intact, drafts stay hidden before server confirmation, denied reads preserve saved bytes while new input remains usable, and reload issues no mutation or visible error.
- `client-race.log`: 688 cases across 56 suites, covering all race, player-state deletion and browser-storage cases.
- `full-client.log`: all 176 runnable suites pass with 1,562 passing tests; the existing 13 suites and 95 tests remain skipped.
- Portal types, TSDoc, file sizes, security, scalability, all seven isolated builds and their exact artifact/dependency verifier pass.

`docs/common/development/development-tasks/race-draft-storage-failure.json` includes all 33 prior gates plus the full client suite. Stable full-source verification and automatic dashboard completion remain pending until the other user's active hosted pathway E2E chat finishes editing evidence. Focused evidence is recorded separately and does not replace the required stable-source receipt.

The pinned active Jest preview has not been replaced or published. These client changes require no Firebase Functions deployment. The multiplayer reliability audit remains active.
