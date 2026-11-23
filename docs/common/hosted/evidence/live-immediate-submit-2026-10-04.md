# Submit the current multiplayer answer before rendering — 4 October 2026

In the actual two-human multiplayer game, a completed `test` followed by ordinary Enter in the same browser task sent no guess when the last rendered draft was empty. Replacing a rendered `zzzz` with `test` and immediately pressing Enter sent the old `zzzz`. Functional React draft updates preserved the ordered letters for later rendering, but the submit callback still read the previous render.

`useLiveRaceDraft` now owns the ordered local draft and publishes immutable snapshots to React. Its stable transition callback computes each input, accepted receipt and definitive rejection once, outside React's replayable state updater. Its stable reader lets an explicit submit capture every preceding edit before React renders. Rendering cannot rewind this owner. The submit copies the current checkpoint, clears the next attempt through the same owner, and preserves the existing idempotent command and pending receipt locks. Server authority and exact ticket/question identity remain unchanged.

## Verification

Artifacts are in `artifacts/live-immediate-submit-2026-10-04`; `verification-summary.json` asserts observed counts, final gate outputs and owned source hashes.

| Check | Result |
| --- | --- |
| Original actual game, fresh completed input + Enter | No request, expected one `test` |
| Original actual game, full old draft replaced + Enter | `zzzz` sent, expected `test` |
| Final production fixture with captured original source | Same no-request failure |
| New actual two-human matrix | 306 checks across 48 journeys |
| Modes / viewports | Development and production React with Strict Mode wrappers; 390×568, 390×844, 1280×844 |
| Immediate-submit cases | Fresh burst, last letter, replacing a full draft, completed composition, mixed software editing, global keyboard, hinted draft, held wrong-answer receipt |
| Duplicate Enter | One admitted command in each immediate-submit case |
| Pending-draft/receipt recovery regression | 708 checks pass |
| Native question ownership regression | 438 checks pass |
| Native keyboard/lifetime regression | 376 checks pass |
| Race IME/dialog regression | 348 checks pass |
| Shared single-player/live rapid-edit regression | 768 checks pass |
| Total injected browser checks | 2,944 pass |
| Portal units | 2,719 pass across 296 suites; 121 optional browser cases skipped in unit mode |
| Final built-game journeys | 37 pass across seven hosted, Reddit, profile, economy, YouTube and candidate suites |
| Types and TSDoc | Pass; 25,141 documented declarations across 1,137 files |
| Six builds / isolation audits | Jest, Facebook, Reddit, YouTube, Netflix, Yahoo pass |
| Source stability | All 764 tracked input paths unchanged throughout final verification |

The verifier mounts the actual `RaceTo10Game` with two human fixture seats and a same-origin HTTP transport. It injects the explicit input/Enter timing, checks the exact submitted word, one authoritative riddle advance, consumed next editor, no local material save and browser error/rejection state. The held wrong-answer case additionally checks that text typed immediately after submitting is separate from the command, survives its receipt, and is used by the next immediate submit. This uses the real editor and draft ownership; no replacement editor or submit callback supplies the pass signal.

`test:live-immediate-submit:browser` registers both React modes in the game browser chain. `LIVE_IMMEDIATE_BASELINE_DIR` substitutes the captured original `LiveRaceGame`; optional quick/case filters support the two original reproductions. The first expanded matrices mistakenly waited for the guess board to grow a row. The actual board always renders five rows; the wait now observes the accepted `zzzz` in the first row. Initial timeout artifacts are retained under `development-first` and `production-first`. The corrected held-receipt case and all final matrices passed.

The existing pending-input matrix covers wrong/help/poll receipts, retrying the original word with its original id, definitive rejection with and without newer edits, deliberate clearing, owner retirement and closing. The question matrix covers retiring native editors at authority identity changes. Keyboard and IME matrices cover subscription cleanup, retained retired callbacks, device keyboard deletion and protected composition keys. These checks guard the wider ownership paths changed by synchronously applying transitions.

## Firefox MCP

Alice and Bob joined through native Firefox MCP controls at 390×568. Injected same-task `test` and duplicate ordinary Enter sent one `test` for `q0` and advanced to 1/10. Native typing produced a rendered `zzzz` on the next question; injected software deletion, new `test` and duplicate Enter sent the new `test` for `q1` and advanced to 2/10. Native typing of `test` and Enter then completed `q2`, reaching 3/10. Exactly three guess request ids were used; no leave command, browser error or unhandled rejection occurred. Consumed native values were empty after both injected cases.

`firefox-mcp-proof.json` retains raw and parsed observations, asserted before marking verification successful. Both owned tabs and their fixture were closed; the original blank tab remained. Rapid input, software events and duplicate Enter were injected. Joining, focusing, old-draft typing and the final ordinary answer used native MCP interaction. This verifies the explicit event/rendering seam, not OS keyboard batching, real-user latency or production multiplayer service performance.

## Review and scope

The hook keeps transient ownership in a component-local ref and UI projection in state. Stable reader/transition callbacks preserve the existing delivery effect lifetimes. Only the admitted transition callback writes the draft owner; refs are not overwritten from delayed renders and there are no side effects inside a functional React state updater. Existing pure normalization, hint locking, draft revisions and rejection rules are retained. No new timer, global event subscription, provider SDK, visible copy, locale key, economy authority, multiplayer protocol or save schema is introduced.

All owned sources are within their file-size limits. The unrelated authentication test-size limitation recorded in the preceding pass was not changed or rechecked here. No commit, push, deployment or publication occurred. The broader reliability, performance, playability and latency goal remains active.
