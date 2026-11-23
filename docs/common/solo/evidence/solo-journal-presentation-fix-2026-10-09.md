# Safe restoration of pending single-player boards — 2026-10-09

Persisted presentation rows could pass the journal reader and then crash feedback computation during cold restoration. The prior diagnostic reproduced three failures with null rows, empty rows and null guess cells; the pending request remained intact. This pass fixes that boundary without clearing, rewriting or issuing replacement delivery receipts.

The reducer checks saved current cells, scored words, aligned feedback, cursor and engine snapshot before using them. Malformed presentation falls back to the currently loaded host state. Invalid draft cells are ignored; valid unsubmitted drafts and their editable cursor survive. The journal reader accepts base records whose presentation arrays are missing, so otherwise valid durable requests remain recoverable. Rejection restoration also avoids spreading an unusable board checkpoint.

The recovery hook supplies each original pending attempt slot to the reducer. When presentation is unusable and host history is complete, already confirmed slots are not appended again. Later pending attempts are previewed normally. This affects the displayed projection only: the delivery queue retains original IDs, payloads and order, and the normal lease/retry path sends those same messages. Terminal authority and purchased hint reconciliation retain their existing guards.

## Verification

- Focused recovery, reducer, checkpoint, journal and hook suite: 242 tests passed across six suites.
- Full client suite on the final source: 3,141 tests passed across 308 suites; 96 gated tests and 16 suites skipped.
- Injected real React router, recovery hook, durable storage, reducer, board and keyboard: 80 browser journeys and 720 assertions passed. Chromium 153 and Firefox 153, development and production React, widths 390 and 1280. Five corruptions (null row, empty row, null guess cells, missing current cells, invalid engine rows), each with and without an already confirmed host attempt. Exact initial delivery, durable request, retry bytes, one displayed row/attempt, retained draft/cursor and no browser errors checked.
- Type checking, TSDoc and source-size audit passed.
- All six isolated client artifacts (Jest, Facebook, Reddit, YouTube fixture, Netflix candidate, Yahoo candidate) and Devvit server built successfully. Archived 1,299 output files and six dependency inventories; removed only the owned temporary build root after archiving.
- 2,547 selected source/configuration inputs match before testing, terminal completion and final archival. Delta from the prior verified cohort: four portal production files and one new regression test. No core/backend changes in this pass.

Evidence: `artifacts/solo-journal-presentation-fix-2026-10-09/`. Browser harnesses use an injected host and controlled retry clock; this is recovery behavior verification, not a live backend acknowledgement, physical device or player latency measurement. YouTube uses the repository fixture content build. No deployment or publication occurred. The broader improvement goal remains active.
