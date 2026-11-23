# Preserve ordered local answer edits — 4 October 2026

Four back-to-back native text events for `rome` left only `e` in the actual single-player app. The view calculated each insertion from its last rendered snapshot; React had not rendered the previous edit yet. The same actual two-human live-race reproduction preserved `test`, because its draft edits already use functional state updates.

`LocalSoloAuthority.insertText` and `backspace` now apply the existing input rules to the current authority-owned letters and cursor. The shared local view delegates text, native deletion and its on-screen keyboard through these commands. Every edit observes its predecessor immediately, without waiting for React or cloning the durable save to obtain a fresh draft. Hint projections, grapheme normalization, committed-text capacity, admission guards and ephemeral editing during a pending save remain in the authority path. Material submits still use the save gate. This applies to the shared YouTube, Netflix and Yahoo local app.

## Verification

Artifacts are in `artifacts/rapid-answer-edits-2026-10-04`. The summary asserts actual observation counts, final gate outputs, owned source hashes and unchanged build inputs.

| Check | Result |
| --- | --- |
| Original actual single-player reproduction | `e`, expected `rome` |
| Captured original handler substituted into final production fixture | Same lost-input failure |
| Original actual two-human race comparison | Ordered `test` preserved |
| New browser matrix | 768 checks across 96 actual-app journeys |
| Matrix modes and sizes | Development/production React with Strict Mode wrappers; 390×568, 390×844, 1280×844 |
| Ordered edit cases | Text burst, text/delete/text, consecutive software deletes, cursor/text, composition/text, microtask text, deliberate repetition, physical Backspace |
| Existing composition delivery | 1,080 checks pass |
| Existing input admission | 174 checks pass |
| Existing Playable IME boundary | 336 checks pass |
| Existing committed-text capacity | 330 checks pass |
| Total injected browser checks | 2,688 pass |
| Portal unit tests | 2,719 pass across 296 suites; 121 optional browser cases skipped in unit mode |
| Built-game journeys | 37 pass across seven hosted, Reddit, profile, economy, YouTube and candidate suites |
| Types and TSDoc | Pass; 25,133 documented declarations across 1,136 files |
| Six final builds and isolation audits | Jest, Facebook, Reddit, YouTube, Netflix, Yahoo pass |
| Final source stability | All 763 tracked input paths unchanged through final verification |

The new verifier mounts the actual local app and actual two-human race with bundled content and a same-origin injected race transport. It checks the ordered draft, empty consumed native value, no input-triggered save or guess, explicit subsequent first-attempt win or one-riddle advance, and browser error/rejection state. `test:rapid-answer-edits:browser` registers development and production verification in the game browser chain. `RAPID_ANSWER_BASELINE_DIR` substitutes the captured original view. No editor is replaced by a test implementation.

Two new authority tests cover ordered insertion/selection/deletion without a subscriber render, no material draft saves, immutable hints, paused admission and a subsequent first-attempt win. Existing late-edit cases now exercise the new commands in menu, continue and result states. The existing delayed-save test uses the new insertion command while confirming that another material submit remains serialized.

## Firefox MCP

At 390×568, an injected same-task four-event `rome` burst produced the full draft, an empty native value, one start save and no result. Two injected same-task software deletions left `ro` without another save. Native MCP typing of `me` and Enter then produced one first-attempt win and exactly one additional save. No browser error or unhandled rejection occurred. `firefox-mcp-proof.json` retains raw and parsed observations, asserted before marking verification successful. The owned Firefox tab and local fixture were closed; the original blank tab stayed open.

Burst input and software events were injected; starting play, physical typing and Enter used native Firefox MCP interaction. This proves the stated rendering/event seam, not operating-system keyboard batching or production latency. No timing improvement is claimed. No visible copy, locale key, SDK, protocol, purchase authority or persistent save schema changed. No commit, push or deployment occurred.

The repository-wide file-size audit separately flags the unrelated authentication browser test at 1,221 equivalent lines against its 1,200 limit. This pass's owned source files remain below their limits; the unrelated file was preserved. The wider reliability, performance, playability and latency goal remains active.
