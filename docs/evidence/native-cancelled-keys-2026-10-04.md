# Preserve earlier native key ownership — 4 October 2026

In the actual local single-player game, a native Backspace already prevented by a capture handler still deleted `ro` to `r`. The actual two-human race reproduced the same fault, deleting `te` to `t`. Prevented Enter also reached submission: the local game added a second material save, and a production fixture with the captured original live editor sent one guess. A prevented ordinary key cleared the committed composition marker, letting a later matching `ro` input duplicate into `roro`.

Both native editors now return when `event.defaultPrevented` is true, before changing composition ownership or invoking answer actions. The existing composing/229 guards remain in the same condition. This aligns native key handling with the existing shared global-keyboard and raw software-deletion handlers. It adds no listener, timer, state or ref. Live multiplayer and the shared YouTube/Netflix/Yahoo local editor use these guards.

## Verification

Artifacts are in `artifacts/native-cancelled-keys-2026-10-04`. The summary asserts original failures, final observation counts, gate output and source hashes.

| Check | Result |
| --- | --- |
| Original local / live cancelled Backspace | `r` / `t`, expected `ro` / `te` |
| Original local cancelled Enter | Save count 2, expected 1 |
| Original local cancelled composition-boundary key | `roro`, expected `ro` |
| Captured original editors in final production fixture | Same Backspace fault and live cancelled Enter sends one guess |
| New actual-app matrix | 396 checks across 36 local/two-human journeys |
| Matrix scope | Development/production React with Strict Mode wrappers; 390×568, 390×844, 1280×844; cancelled Backspace, Enter and composition marker |
| Existing composition delivery | 1,080 checks pass |
| Existing immediate live submission | 306 checks pass |
| Existing keyboard/lifetime | 376 checks pass |
| Existing race IME/dialog | 348 checks pass |
| Existing local Playable IME | 336 checks pass |
| Existing local input admission | 174 checks pass |
| Total injected browser checks | 3,016 pass |
| Portal units | 2,719 pass across 296 suites; 121 optional browser cases skipped in unit mode |
| Final built-game journeys | 37 pass across seven hosted, Reddit, profile, economy, YouTube and candidate suites |
| Types and TSDoc | Pass; 25,141 documented declarations across 1,137 files |
| Final builds / isolation audits | Jest, Facebook, Reddit, YouTube, Netflix, Yahoo pass |
| Source stability | All 764 tracked input paths unchanged throughout final verification |

The new fixture mounts actual `YouTubePlayableApp` and `RaceTo10Game` surfaces. An earlier native capture listener calls only `preventDefault`; the event continues to React. It checks the cancellation flag, unchanged draft, no input-triggered save/guess, preserved composition marker, empty consumed native value, and a subsequent ordinary first-attempt win or one-riddle advance. `test:native-cancelled-keys:browser` registers both modes in the game browser chain. `NATIVE_CANCELLED_BASELINE_DIR` substitutes the captured original editor source. The actual editors and submit handlers are not replaced with test implementations.

## Firefox MCP

At 390×568, native Firefox key presses reached an injected earlier capture handler and were observed as trusted events. In single-player, consumed Backspace preserved `ro`; a consumed `x` preserved the composition marker against an injected trailing `ro`; consumed Enter preserved a complete `rome`, one start save and no result. Removing the capture listener and pressing ordinary Enter produced one first-attempt win and one additional save.

Alice and Bob joined the live fixture through native MCP controls. Consumed Backspace preserved `te`. Native `st` followed by consumed Enter kept `test` without a guess or leave. Removing the capture listener and pressing ordinary Enter sent exactly one `test`, advancing to 1/10. Neither target produced a browser error or unhandled rejection.

`firefox-mcp-proof.json` retains raw and parsed observations, asserted before marking verification successful. Capture handlers and composition/trailing events were injected; gameplay selection, joining, typing, Backspace and Enter used native MCP controls. This verifies an explicit earlier-handler ownership pattern, not provider-specific hotkeys, OS IME behavior or production latency. All owned verification tabs and their fixture were closed; the original blank tab remained open.

## Review and scope

Both early returns precede marker retirement, so another consumer cannot accidentally retire composition deduplication. Ordinary keys still reach the previous behavior, and existing physical/software deletion, rapid-submit, IME and mounted-listener cleanup regressions passed. Native metadata, disabled state, locale/RTL behavior and platform boundaries are unchanged. Reviewing the React event-handler/ref and listener guidance required no new subscriptions or transient state.

No visible copy, locale key, SDK, economy authority, multiplayer protocol or persistent save schema changed. The unrelated authentication test-size limitation recorded in an earlier pass was preserved and not rechecked here. No commit, push, deployment or publication occurred. The broader reliability, performance, playability and latency goal remains active.
