# Stop enumerating ignored answer suffixes — 4 October 2026

Committing a four-letter answer followed by 20,000 ignored characters enumerated 20,028 grapheme records in the actual local single-player game and 40,012 in the actual two-human race. Both already limited the letters written to the answer, but they first allocated the entire segmented input. The live native editor also segmented and rejoined that whole string before the race editor segmented it again.

A shared `iterateGraphemes` generator now lets each answer editor stop after its initially available capacity. It uses the existing cached locale segmenter, NFC normalization and code-point fallback. The live native editor hands normalized text directly to the answer editor. Existing full-array helpers retain their implementation and public behavior. The two targets keep their existing validation, whitespace handling, hint locks, selected-letter replacement, ignored-edit identity and draft immutability.

## Measured work and timing

Artifacts are in `artifacts/bounded-grapheme-input-2026-10-04`. Captured originals, failing observations, the owned source diff, raw timing samples and an asserted verification summary are retained.

| Actual game, committed paste at 390×568 | Original enumeration | Updated enumeration | Original synchronous editing sample | Updated sample |
| --- | ---: | ---: | ---: | ---: |
| Local single-player | 20,028 | 28 | 1.2 ms | 0.1 ms |
| Two-human live race | 40,012 | 8 | 2.3 ms | 0.1 ms |

The fixtures count yielded records through an explicitly enabled `Intl.Segmenter` iterator observer. During timing that observer returns the original native Segments object without per-record counting. Nine repetitions reset the draft, assign the native input value and dispatch a committed input event; the first warmup is discarded. The reported statistic is the upper middle of eight sorted retained samples. Timing covers synchronous input dispatch, editing and projection, excluding React commit/paint, network, and the full frame. Samples are fixture- and machine-specific, near the 0.1 ms timer resolution, and do not establish production latency or FPS.

Updated development/production matrices cover paste, committed composition and hinted answers at 390×568, 390×844 and 1280×844. Normal paste/composition enumerate 28 local and eight live records; hinted edits enumerate 29 local and six live records. NFC normalization still processes the whole string, and built-in segmentation internals may do so too. A long rejected prefix still needs scanning to find accepted characters. This bounds enumeration of the ignored accepted suffix; it does not promise constant CPU cost for every arbitrary input.

## Verification

| Check | Result |
| --- | --- |
| New actual-app matrix | 324 assertions across 36 local/two-human journeys |
| Existing capacity | 330 assertions pass |
| Existing composition delivery | 1,080 assertions pass |
| Existing rapid editing | 768 assertions pass |
| Existing immediate live submission | 306 assertions pass |
| Existing local IME boundary | 336 assertions pass |
| Existing race IME/dialog | 348 assertions pass |
| Existing cancelled native keys | 396 assertions pass |
| Total injected browser assertions | 3,888 pass |
| Differential policy comparison | 8,192 output comparisons, 8,192 identity checks and 8,192 immutability checks pass |
| Policy comparison scope | 4,096 seeded cases across all 16 supported locales, with native segmentation and the existing code-point fallback |
| Core units | 318 pass across 35 suites |
| Portal units | 2,721 pass across 296 suites; 121 optional browser cases skipped in unit mode |
| Built-game journeys | 37 pass across seven hosted, Reddit, profile, economy, YouTube and candidate suites |
| Types and TSDoc | Pass; 25,152 documented declarations across 1,138 files |
| Builds and isolation audits | Jest, Facebook, Reddit, YouTube, Netflix and Yahoo pass |
| Final replay source stability | All 765 input paths unchanged throughout re-verification |

The new fixture mounts actual `YouTubePlayableApp` and `RaceTo10Game`, checks the bounded answer and work count, preserves empty consumed native input, checks that editing adds no material save or guess, and completes an ordinary explicit first-attempt win or one-riddle advance. Both React modes use Strict Mode wrappers. `test:bounded-grapheme-input:browser` registers the development/production checks in the existing game browser chain. Original-source substitution reproduces the excessive enumeration without replacing gameplay controllers or submit handlers.

An initial expanded hint journey failed because the fixture left focus on the Hint button before its physical Backspace cleanup. The fixture now explicitly refocuses the native editor after observing the hint receipt; no production focus behavior changed. Initial failures are retained separately from final passing observations.

The first final source-inventory check found concurrent changes to live race UI/styles and browser support, including a new search-wheel component. Those changes were preserved. All six builds/audits, portal units/types/TSDoc, the 3,888 injected assertions and the 37 built-game journeys were replayed against a newly captured 765-path snapshot. `concurrent-source-change.json` records the difference, and `reverification-inputs-before.json` / `reverification-inputs-after.json` verify the complete path inventory and hashes. Earlier timing and Firefox evidence are retained as earlier observations; reverified browser reports demonstrate current-checkout compatibility.

## Firefox MCP

At 390×568, injected committed text of 20,004 characters enumerated 28 records in single-player, retained `rome`, cleared native input and produced no input-triggered save or result. Native Firefox Enter then produced one first-attempt win, one result and one additional material save.

Alice and Bob joined the live fixture through native MCP controls. Injected composition plus a matching trailing input enumerated eight records, retained `test`, cleared native input and sent no guess. Native Enter sent exactly one `test`, advancing to 1/10 without leaving. Neither target produced a browser error or unhandled rejection. Raw and parsed observations were asserted before `firefox-mcp-proof.json` was marked verified.

Long text, composition and trailing delivery were injected; game selection, joining and Enter used native Firefox controls. This verifies the fixture interaction pattern, not OS paste/IME behavior or production latency. Owned verification tabs and the fixture were closed; the original blank tab remained open.

## Scope

No visible copy, locale key, provider SDK, authority protocol, economy grant or persistent save schema changed in this pass. All target boundary audits passed. The unrelated authentication test-size limitation recorded in an earlier pass was preserved and not rechecked here. No commit, push, deployment or publication occurred. The broader reliability, performance, playability and latency goal remains active.
