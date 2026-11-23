# Retire interrupted local answer composition — 4 October 2026

In the actual local single-player game, a controlled composition start followed by a committed pause/resume interval left the native editor's composing flag active. Fresh physical `me` then left the existing draft at `ro`, rather than completing `rome`. Clearing only the native text buffer still failed. A minimized composition-start-only reproduction also ignored fresh text. A new composition session completed successfully in the original editor, distinguishing stale composition ownership from cursor, validation or authority failure.

The local native editor now retires unfinished composition when it becomes disabled, clears provisional native text and retains its normalized value as a trailing-input marker. A composition end can publish text only if this editable interval owned its start and the editor remains enabled. Orphan or disabled end delivery clears native text and preserves deduplication instead of committing a retired value. New composition starts remain blocked while disabled. Existing completed-composition markers survive a disabled interval.

This applies to the shared YouTube/Netflix/Yahoo single-player editor. The live race editor implementation is unchanged: its current owner deliberately allows composition while a Hint receipt is pending. The new live controls verify that both composition completion and matching trailing delivery continue to work during that pending interval.

## Verification

Artifacts are in `artifacts/native-composition-retirement-2026-10-04`, including captured originals, failing reproductions, positive controls, source diff, Firefox proof and an asserted verification summary.

| Check | Result |
| --- | --- |
| Original local interrupted composition → physical `me` | `ro`, expected `rome` |
| Original minimized interruption → physical `rome` | Empty draft, expected `rome` |
| Original buffer-only clearing control | Still `ro`, expected `rome` |
| Original completed-composition / fresh-composition controls | Both complete one win |
| Original late end plus trailing input after resume | `roxy`, expected `ro` |
| Original NFC-equivalent late delivery | `roé`, expected `ro` |
| New matrix | 408 assertions across 36 actual-app journeys |
| New local coverage | 288 assertions: missing end, late end with decomposed/composed NFC delivery, completed trailing delivery and a fresh composition session |
| New live coverage | 120 assertions: composition completion and matching trailing delivery while a Hint receipt is held; editor remains enabled |
| Matrix scope | Development/production React with Strict Mode wrappers; 390×568, 390×844 and 1280×844 |
| Existing composition delivery | 1,080 assertions pass |
| Existing cancelled native keys | 396 assertions pass |
| Existing local IME boundary | 336 assertions pass |
| Existing race IME/dialog | 348 assertions pass |
| Existing capacity | 330 assertions pass |
| Existing long-input work | 324 assertions pass |
| Existing rapid editing | 768 assertions pass |
| Existing immediate live submission | 306 assertions pass |
| Existing local focus | 462 assertions pass |
| Existing unchanged input | 330 assertions pass |
| Total injected browser assertions | 5,088 pass |
| Portal units | 2,724 pass across 296 suites; 121 optional browser cases skipped in unit mode |
| Built-game journeys | 37 pass across seven hosted, Reddit, profile, economy, YouTube and candidate suites |
| Types and TSDoc | Pass; 25,166 documented declarations across 1,138 files |
| Final builds and isolation audits | Jest, Facebook, Reddit, YouTube, Netflix and Yahoo pass |
| Final source stability | Complete 765-path input inventory and hashes unchanged throughout final verification; live editor matches its captured original |

The fixture mounts actual `YouTubePlayableApp` and `RaceTo10Game` surfaces. It injects composition and lifecycle delivery, checks committed prefixes, native-editor identity, enabled state, fresh input, empty consumed native values and absence of editing-triggered saves or guesses. Each journey ends with an explicit native Enter producing one first-attempt local win or one live-riddle advance. The new `test:native-composition-retirement:browser` command registers both React modes in the existing game browser chain.

An initial live fixture incorrectly expected a held Hint to disable input and timed out. Inspecting the current owner showed it intentionally keeps drafting enabled; that experiment did not establish a live defect. The fixture was corrected to verify continuity, and the tentative live-editor changes were removed after verifying that no concurrent edit would be overwritten. Those initial diagnostics are retained separately from the passing final matrices.

## Firefox MCP

At 390×568, native Classic selection and typing `ro` reached the actual game. Injected composition plus SDK pause produced an explicitly observed disabled editor, cleared native text, preserved `ro` and left the start-save count at one. A separate resume call restored enabled input and focus. Native `me` without an input UID or refocus completed `rome`; native Enter produced one win, one result and one additional save.

On a fresh game, separate lifecycle calls again established the disabled/resumed boundary. An injected late `xy` composition end and matching trailing input preserved `ro`, cleared native text and added no save. Native `me` and Enter then completed one win without a browser error or unhandled rejection. Nine raw and parsed observations were asserted before `firefox-mcp-proof.json` was marked verified.

A first combined Firefox pause/resume evaluation did not observe the disabled interval and did not prove retirement. Its raw result is retained as an unverified diagnostic. The successful run used separate calls and explicit DOM-state assertions. All four owned tabs, including the failed-navigation diagnostic tab, and their fixture were closed; the original blank tab remained open.

## Contract and scope

The [UI Events composition-end contract](https://www.w3.org/TR/uievents/#event-type-compositionend) normally requires an end event when composition completes or is canceled. Missing or delayed delivery here is deliberate fault injection, not evidence that a browser or OS IME violates that contract. Retirement depends on an observed disabled editing interval; this pass does not promise cancellation for pause/resume pulses that never commit that interval to the editor.

React review keeps cancellation on a primitive disabled-state effect with a stable input ref. The effect does not run per letter and adds no listener, timer or render state. Checking active composition before publication rejects old end delivery while preserving a newly started session. The existing marker remains available when a completed composition's trailing input crosses pause/resume, avoiding duplicate letters. Native 229/isComposing/default-prevented guards, metadata, locale/RTL behavior and explicit submission remain intact.

No visible copy, locale key, provider SDK, persistent save schema, economy authority or multiplayer protocol changed. All six target boundary audits passed. The unrelated authentication test-size limitation recorded in an earlier pass was preserved and not rechecked here. No commit, push, deployment or publication occurred. The broader reliability, performance, playability and latency goal remains active.
