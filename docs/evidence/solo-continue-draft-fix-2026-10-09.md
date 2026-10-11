# Paid Continue draft restoration — 2026-10-09

The initial paid recovery path ignored malformed draft cells during ordinary journal restoration, then copied those same cells into the granted Continue row. A correctly shaped draft could also replace an authoritative purchased hint glyph with another letter at its locked position. The real storage/reducer diagnostic reproduced four failures (null, object and multiple-grapheme cells, plus a conflicting locked hint letter) and one passing valid control. The exact paid request survived storage unchanged.

The Continue preview now validates every draft cell before restoring it. An unusable draft leaves the granted attempt's safe reset row intact; it does not revoke the provisional grant, drop the paid delivery or change its request ID. For a valid draft, confirmed locked hint positions retain the grant's existing glyphs, while other unsubmitted letters and an editable saved cursor survive. Cursor fallback uses the merged row. Charge, grant, retry and receipt semantics are unchanged.

## Verification

- Original diagnostic: four failures and one passing control under `artifacts/solo-continue-draft-audit-2026-10-09/`. Identical diagnostic on final source: all five passed.
- Five permanent regressions verify exact durable paid request, valid and invalid drafts, purchased hint preservation, editable typing, cursor, one provisional deduction, attempt count and retained Continue grant. Focused suite: 221 tests across five suites passed.
- Full client suite: 3,167 passing tests across 309 suites; 96 gated tests and 16 suites skipped.
- Real injected router, recovery hook, reducer, durable storage, board and keyboard: 40 journeys and 600 passing assertions. Chromium 153 and Firefox 153, development and production React, widths 390 and 1280. Three malformed drafts, a conflicting hint draft and a valid control. Checks cover active grant, five original attempts, reset row, single provisional deduction, locked hint and keyboard knowledge, exact initial/durable/retry paid messages, no second retry deduction, successful typing, injected successful paid receipt, retained grant after settlement, confirmed projected balance and no browser errors.
- Type checking, TSDoc and source-size audit passed. All six isolated client targets (Jest, Facebook, Reddit, YouTube fixture, Netflix candidate, Yahoo candidate) and Devvit server built.
- Archived 1,299 build outputs and six dependency inventories, then removed only the owned temporary build root. All test/build/browser processes terminated successfully.
- 2,548 selected source/configuration inputs match before verification, after process completion and after archival. Delta from preceding verified cohort: reducer change and one new regression file. No core, backend or locale changes.

Final evidence: `artifacts/solo-continue-draft-fix-2026-10-09/`. Browser receipt settlement uses an injected host and controlled retry clock; this does not claim a live economy transaction or physical-device latency measurement. No deployment or publication occurred. The broader improvement goal remains active.
