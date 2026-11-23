# Bound one committed single-player text unit — 4 October 2026

Pasting `romeEXTRAS` into the actual shared single-player app changed the four-letter answer to `roms`. After filling the row, the insertion loop repeatedly replaced its last active position with the overflow. A selected filled slot and a row containing a paid locked hint showed the same bug. The multiplayer editor already bounds one committed text unit to its initially available positions.

The local single-player input helper now computes the initial editable capacity: empty unlocked positions plus the originally selected unlocked filled position, if any. One paste or composition consumes only that many normalized letter graphemes. It preserves filled nonselected letters and locked hints. A later separate keystroke can still replace the selected letter. YouTube, Netflix, and Yahoo share the helper. Material commands and save admission are unchanged.

## Verification

Artifacts are under `artifacts/playable-text-capacity-2026-10-04`; `verification-summary.json` records asserted totals, timings, and source hashes.

| Check | Result |
| --- | --- |
| Original actual-app reproduction | `romeEXTRAS` becomes `roms`, expected `rome` |
| Original input tests | Three failures: empty row, selected filled slot, and locked Japanese hint |
| Final harness with original source | 5,004-character paste becomes `romz`, expected `rome` |
| New input tests | All three pass; focused local and multiplayer input suites pass |
| Final portal units | 2,717 pass across 296 suites; 121 browser cases skipped in this unit run |
| New actual-app matrix | 330 checks across 36 journeys in development and production React with Strict Mode wrappers |
| New scenarios | Paste, composition plus trailing input, selected filled slot, paid hint, separate keystrokes, and long paste |
| Viewports | 390×568, 390×844, 1280×844 |
| IME boundary regression | 336 checks pass |
| Input admission regression | 174 checks pass |
| Total injected browser checks | 840 pass |
| Final built journeys | 37 pass across seven hosted, Reddit, profile, economy, YouTube, and standalone candidate suites |
| Final types and TSDoc | Passed; 25,119 documented declarations across 1,136 files |
| Target builds and audits | Jest, Facebook, Reddit, YouTube, Netflix, Yahoo passed |
| Source stability | 763 paths tracked; runtime/configuration unchanged; one concurrent test change received refreshed unit/type/documentation checks |

The regression renders the actual `YouTubePlayableApp`, real local authority, bundled fixture content, and an injected SDK save boundary. It checks draft contents, no input-triggered material write or guess, consumed native text, one explicit first-attempt win, and preserved hint locks. `test:playable-text-capacity:browser` runs both React modes and is included in the existing browser chain. `PLAYABLE_CAPACITY_BASELINE_FILE` substitutes the captured original input helper.

A concurrent change added two timeout cases to `useHostRiddleLifecycle.test.ts`. The change was preserved. Its three missing declaration comments were added without changing behavior. Full units, types, and documentation checks were refreshed; final units contain 2,717 cases compared with 2,715 in the initial run. Before/after source inventories show that this test was the only changed path. Runtime and build configuration fingerprints match the completed six builds and 37 built journeys. The document-only repair is recorded against `useHostRiddleLifecycle.test.before-doc.txt`.

## Controlled input handling cost

The long-paste scenario dispatches one native `input` event containing 5,004 characters into an empty four-letter answer. It measures synchronous dispatch and handler work, warms up three times, and records ten samples. Native Backspace clears each attempt between samples. At 390×568 with production React, the original median was **1.7 ms** and the updated median was **0.4 ms**. Updated medians were 0.4–0.5 ms across the three production viewports. Raw samples are in each matrix's `*-paste-timing.json`.

This measures bounded insertion work in a local browser fixture. Segmentation still examines the text, and asynchronous React commit, full frame latency, and production network time are outside the measurement. The original source also fails the draft-correctness assertion; the measurement is not a claim of a universal speedup for ordinary short typing.

## Firefox MCP

At 390×568, an injected native paste produced `rome`, emptied the consumed editor, and retained exactly one start save and no result. Native Enter made save two with one first-attempt win. In a fresh game, a native hint click made save two and charged 25 local coins once. An injected overflowing composition and trailing input preserved the locked `r` and filled `ome` without another save. Native Enter made save three with one first-attempt win. No browser errors or unhandled promises occurred. Raw and parsed asserted observations are in `firefox-mcp-proof.json`.

Paste/composition deliveries were injected through DOM events. Mode selection, hint purchase, slot focus, and Enter used native Firefox MCP interaction. This does not certify an operating-system IME or clipboard. Owned verification tabs and the fixture server were closed; the original Firefox tab remained open.

An initial production-run approval review hit temporary model capacity and did not execute the command. Retrying the same approval path succeeded. No visible copy, translation key, provider SDK, multiplayer protocol, or backend contract changed. No commit or deployment was performed. The wider improvement goal remains active.
