# Preserve composition deduplication across browser events — 4 October 2026

In the actual shared single-player app, a committed `ro` became `roro` when a matching trailing input arrived in a separate browser event. The actual two-player live race reproduced the same pattern: `te` became `tete`. Both native answer components cleared their committed-text marker in a microtask, before the separately delivered trailing event could use it.

The marker now lasts until one matching trailing input is consumed or another edit begins. A different input value, ordinary physical key, paste, new composition, or recognized noncomposition native `beforeinput` retires it. This preserves deliberate repeated characters, including software keyboards that omit keydown. The existing raw `beforeinput` subscription supplies the new-edit signal; it retains its mounted-listener guard, disabled/composing guards, software Backspace behavior, and cleanup. No new global listener or timer is added. Live multiplayer and the shared YouTube/Netflix/Yahoo local editor use this handling.

## Verification

Artifacts are under `artifacts/native-composition-delivery-2026-10-04`; `verification-summary.json` records asserted totals and source hashes.

| Check | Result |
| --- | --- |
| Original actual single-player reproduction | `ro` becomes `roro`, expected `ro` |
| Original actual live-race reproduction | `te` becomes `tete`, expected `te` |
| Final production harness with original source | Same single-player duplication failure |
| New actual-app matrix | 1,080 checks across 120 journeys, development and production React with Strict Mode wrappers |
| New delivery/edit cases | Same stack, microtask boundary, later task, composition beforeinput, new physical key, software edit, paste, new composition, different text, NFC-equivalent text |
| Viewports | 390×568, 390×844, 1280×844 |
| Existing native keyboard/lifetime regression | 376 checks pass |
| Existing question ownership regression | 438 checks pass |
| Existing Playable IME boundary regression | 336 checks pass |
| Existing input admission regression | 174 checks pass |
| Existing committed-text capacity regression | 330 checks pass |
| Total injected browser checks | 2,734 pass |
| Final portal units | 2,717 pass across 296 suites; 121 browser cases skipped in this unit run |
| Final built journeys | 37 pass across seven hosted, Reddit, profile, economy, YouTube, and standalone candidate suites |
| Final types and TSDoc | Passed; 25,123 documented declarations across 1,136 files |
| Final builds and isolation audits | Jest, Facebook, Reddit, YouTube, Netflix, Yahoo passed |
| Source stability | All 763 tracked input paths unchanged throughout final builds and journeys |

The unified regression renders actual `YouTubePlayableApp` and `RaceTo10Game` surfaces with bundled local content and an injected two-human transport. It checks draft contents, no input-triggered save or guess, empty consumed native text, and an explicit subsequent first-attempt win or one-riddle advance. These are regressions at the real native-event/rendering seam rather than a replacement editor. `test:native-composition-delivery:browser` runs both React modes and is included in the existing browser chain. `COMPOSITION_DELIVERY_BASELINE_DIR` substitutes the captured original components and hook.

The first expanded matrix exposed an event-constructor difference: Chromium converted legacy `insertFromComposition` and `deleteCompositionText` names to an empty `inputType`, while Firefox retained them. The hook now leaves unclassified notifications and composition-linked input types with the composition marker. Recognized ordinary edits still retire it. Initial failures are retained in `development-first` / `production-first`; observed constructor values are recorded in `input-event-type-observations.json`. All final units, types, documentation checks, and six builds were rerun after this classifier change.

The classifier uses native input types and composition state, whose contracts are described by [Input Events Level 2](https://www.w3.org/TR/input-events-2/). [UI Events](https://www.w3.org/TR/uievents/) describes composition event ordering; the compatibility sequence tested here does not establish that current browser/platform IMEs are required to deliver an input after compositionend.

## React review

Both edited components retain transient composition markers in refs. The shared subscription reads the latest editor callbacks without replacing its listener after every draft render. Unmounted native callbacks remain guarded, and the prior ownership/deletion regressions passed. Focus, disabled state, locale, RTL metadata, and target SDK boundaries remain intact. The review used the React skill's event-handler ref, listener ownership, and transient-state guidance.

## Firefox MCP

At 390×568, composition and its matching trailing input were injected in separate MCP calls. Single-player retained `ro`, an empty native value, one start save, and no result. After a new one-letter composition, a native repeated `r` correctly produced `rr`; native Backspace, `rome`, and Enter then produced one first-attempt win and exactly one additional save.

Firefox also joined Alice and Bob through native MCP controls. A live `te` composition followed by a separately delivered composition-linked beforeinput/input retained `te` with no guess or leave command. Native `st` and Enter submitted exactly one `test` and advanced to 1/10. No browser error or unhandled promise occurred. `firefox-mcp-proof.json` contains asserted raw and parsed observations. All owned verification tabs and the fixture were closed; the original Firefox tab remained open.

Composition and trailing events were injected. Selection, joining, repeated physical input, Backspace, typing, and Enter used native Firefox MCP interaction. This is compatibility verification for explicit event patterns, not operating-system IME certification or production latency measurement. No visible copy, translation key, provider SDK, purchase/economy authority, or multiplayer protocol changed. No commit or deployment was performed. The wider improvement goal remains active.
