# Multiplayer Skip input continuity — 4 October 2026

Clicking Skip in the actual live multiplayer game advanced to the next riddle but left focus on the page body. Native browser text insertion then left the next draft empty instead of entering `test`. The minimized original failed with both development and production React. Restoring only native-input focus after the next question appeared made the same original journey complete one answer successfully.

The shared race gameplay Skip handler now focuses the current native editor immediately after dispatching the authorized action. Its existing question-owned ref can then preserve focus when the next question replaces that editor. A player who tabs elsewhere while a receipt is pending keeps that later focus choice. The question-focus hook is unchanged. This adds no effect, render state, listener, timer or network request.

## Verification

Artifacts, captured originals, failing reproductions, controls, source diff, raw Firefox observations and an asserted summary are in `artifacts/race-action-focus-2026-10-04`.

| Check | Result |
| --- | --- |
| Original minimized Skip → native text | Empty draft, expected `test`; development and production |
| Original focus-only controls | Complete native text and one explicit answer |
| New actual-game matrix | 684 assertions across 66 journeys |
| Matrix scope | Development/production React with Strict Mode wrappers; 390×568, 390×844 and 1280×844 |
| Actions covered | Hint, keyboard Hint, wrong submission, shortcut insertion/deletion, Skip, keyboard Skip, held Skip, held Hint, and Tab during held Hint/Skip receipts |
| Existing race IME/dialog | 348 assertions pass |
| Existing immediate live submission | 306 assertions pass |
| Existing composition delivery | 1,080 assertions pass |
| Existing composition retirement | 408 assertions pass |
| Existing single-player action focus | 462 assertions pass |
| Total injected browser assertions | 3,288 pass |
| Portal units | 2,724 pass across 296 suites; 121 optional browser cases skipped in unit mode |
| Built-game journeys | 37 pass across seven hosted, Reddit, profile, economy, YouTube and candidate suites |
| Types and TSDoc | Pass; 25,166 declarations across 1,138 files |
| Target builds and isolation audits | Jest, Facebook, Reddit, YouTube fixture, Netflix and Yahoo pass |
| Source stability | Recollected 765-path source/build-input inventory and hashes match before/after verification |

The new `test:race-action-focus:browser` command runs both React modes in the existing game browser chain. The fixture mounts `RaceTo10Game` with two target-owned live adapters and a same-origin HTTP authority fixture. Browser `insertText` checks native editing independently of the ASCII keydown fallback. Every journey checks complete input, explicit Enter, one intended answer, no repeated Hint/Skip command, native-buffer consumption and absence of browser errors or unhandled rejections. Held-receipt cases verify focus preservation after subsequent Tab navigation.

Initial diagnostic assertions compared command text to lowercase `test`, although the original correctly sent `tEST` through the ASCII fallback and advanced. That was not a submission defect; comparison now normalizes case. A later draft selector included confirmed history and was corrected to select the active row. An overly strict immediate held-Hint focus assertion was also removed after native-text checks passed unchanged. Hint and shortcut implementations were not changed. These initial diagnostics are retained separately from the final matrices and are not counted as positive evidence.

## Firefox MCP

At 390×568, native Start buttons opened the two-player fixture. Native Skip advanced once and left the next native editor focused. Native typing `test`, without an input UID or refocus, reached the complete draft with an empty consumed native buffer and no guess. Native Enter then sent exactly one `test` answer and advanced to 2/10.

With the next Skip receipt deliberately held, its native click immediately focused an enabled editor. Native Tab moved to the Q shortcut. Releasing the receipt advanced to 3/10 and kept that exact shortcut focused, with two Skip commands and the single earlier guess. Six raw and parsed observations were asserted before the proof was marked verified. Both owned tabs and the owned fixture were closed; the original blank tab was preserved.

This verifies browser input and focus behavior against injected transport, not an OS software keyboard/IME certification or production network latency measurement. The change removes an extra focus interaction from the reproduced live Skip path. No visible copy, locale key, SDK, persistent state, economy authority or multiplayer protocol changed. The shared component's other behavior is covered by the portal suite; the new reproduction specifically proves the live race path. No commit, push, deployment or publication occurred. The broader reliability, performance, playability and latency goal remains active.
