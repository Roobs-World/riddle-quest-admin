# Ignore retired and blocked single-player input — 4 October 2026

Late native composition events could reach `LocalSoloAuthority.setInput` after the fifth wrong answer opened the continue prompt. The visible input was disabled, but the authority still admitted its callback and threw `continue-decision-required`. Direct late edits also threw `active-game-required` in the menu and result states. The actual shared Playable UI reproduced the continue error before this change.

Ephemeral input admission now requires an active game that is not awaiting a continue decision, in addition to the existing pause and blocked-save guards. `setInput` and cursor selection ignore stale edits without changing the draft, cursor, balance, or save. Normal pending saves still allow drafting. Material commands retain their strict validation and save rules. YouTube, Netflix, and Yahoo share this local authority.

## Verification

Artifacts are under `artifacts/playable-input-admission-2026-10-04`; `verification-summary.json` records asserted results and source hashes.

| Check | Result |
| --- | --- |
| Original authority unit controls | Three failures: menu, continue, and result late edits throw |
| Exact original-source browser control | A delayed composition commit throws `continue-decision-required` at the disabled continue prompt |
| New authority unit coverage | Three cases pass; unchanged snapshots and write counts, followed by a valid paid continue and sixth-attempt win |
| Focused authority suite | All 26 cases pass |
| Actual-app admission matrix | 174 checks across 24 journeys in development and production React with Strict Mode wrappers |
| Admission scenarios | Exhausted attempts, pause, failed save, and ordinary pending save; each resumes to a usable native draft and one explicit win |
| Previous IME regression matrix | 336 checks pass in both React modes |
| Viewports | 390×568, 390×844, 1280×844 |
| Full portal units | 2,710 passed across 296 suites; 121 browser cases intentionally skipped in this run |
| Types and TSDoc | Passed; 25,110 documented declarations across 1,136 files |
| Final built journeys | 37 passed across seven suites covering hosted play, Reddit, profile, queued economy, YouTube, and standalone candidates |
| Six target builds and isolation audits | Jest, Facebook, Reddit, YouTube, Netflix, Yahoo passed |
| Source stability | All 763 source-input paths unchanged throughout final builds and built journey verification |

The regression uses the actual shared `YouTubePlayableApp`, bundled fixture content, its real local authority, and injected SDK delivery boundaries. It tests ignored input while unavailable, continued input during an ordinary held save, no extra material writes from input, and restored play after each recovery. The original authority can be substituted through `PLAYABLE_ADMISSION_BASELINE_FILE`. `test:playable-input-admission:browser` runs both React modes and is included in the existing browser chain.

Firefox MCP independently exercised five native wrong-answer submissions at 390×568. An injected composition began before the fifth submission and ended after the continue prompt disabled input. Its late events left the `XXXX` draft, six existing saves, five attempts, and balance unchanged, with no browser errors. The native continue action made one additional save and charged 50 local coins once. Native typing and Enter then made save eight with one win and six total guesses. Raw and parsed results are in `firefox-mcp-proof.json`. The owned fixture and verification tab were closed; the original Firefox tab remained open.

A concurrent hosted leaderboard entry change appeared during the initial source inventory check. It was preserved, its missing declaration comment was added, and the unit, type, documentation, and six-build gates were refreshed against the resulting shared revision. Initial fingerprints are preserved in `build-inputs-before-initial.json` and `build-inputs-after-drift.json`.

Composition events were injected through the DOM; fresh typing, submissions, and the continue action used native Firefox MCP interaction. This is local and injected verification, not operating-system IME certification or production network measurement. No visible translation key, provider SDK, backend authority, or global economy changed. No deployment or commit was performed. The wider improvement goal remains active.
