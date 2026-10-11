# Pending checkpoint completion metadata — 2026-10-09

The preceding recovery changes validated scored rows and restricted field ownership, but still trusted the captured completion and reward fields. The initial audit reproduced eight failures: null/object achievement lists, object/unknown modal discriminators, string completion acknowledgement, a malformed reward achievement list, an incomplete outcome and a foreign question's outcome. One valid control passed. The reader retained each original pending request unchanged.

After validating metadata shape, a second diagnostic exposed four contradictory but correctly typed states: a victory dialog without a win, a Continue dialog before its attempt boundary, an outcome attached to a nonterminal engine, and a terminal engine without an outcome. Those are also rejected at the presentation boundary.

The reducer now checks restorable modal discriminators, boolean acknowledgement, achievement lists, finite nonnegative integer reward counters, reward flags, and complete outcome identity. Outcomes must belong to the current issued question and agree with the terminal engine and attempt count. Victory requires a win; Continue requires the original exhausted attempt budget without a prior continue. Unusable metadata causes the established host-state fallback and exact original queued-attempt projection. Queue IDs, payloads, ordering, leases and retries are preserved. Rejection rollback uses the same metadata gate. A positive regression restores a genuine reducer-generated provisional victory, ensuring valid terminal recovery remains supported.

## Final verification

- Original audit: eight failures/one passing control. Intermediate shape-validation audit: four failures/nine passing controls. Both are retained under `artifacts/solo-journal-metadata-audit-2026-10-09/`. The same combined diagnostic passes all thirteen cases on final source.
- Permanent regression additions: fourteen tests, including the genuine provisional victory. Full client suite: 3,162 passing tests across 308 suites; 96 gated tests and 16 suites skipped.
- Injected real React router, pending recovery hook, reducer, durable storage, board and keyboard: 208 journeys and 2,912 assertions passed in Chromium 153 and Firefox 153, development and production React, widths 390 and 1280. Twelve malformed/contradictory metadata cases and one nominal control, each with and without an already confirmed pending attempt. Checks include usable restored metadata, successful subsequent typing, one represented pending attempt, preserved draft/cursor, owner/lifecycle state, exact initial/journal/retry messages, and no browser errors.
- Type checking, TSDoc and source-size audit passed.
- All six isolated clients (Jest, Facebook, Reddit, YouTube fixture, Netflix candidate, Yahoo candidate) and Devvit server built. Archived 1,299 output files and six dependency inventories before removing only the owned temporary build root.
- 2,547 selected source/configuration inputs match before verification, after all processes terminated and after archival. Delta from the preceding verified cohort: reducer and its recovery regression test. No core/backend or locale changes.

Evidence: `artifacts/solo-journal-metadata-fix-2026-10-09/`. Browser verification uses an injected host and controlled retry clock; full completion effects and reward granting are not exercised by this browser harness. This pass makes no player-latency or live-backend acknowledgement claim. No deployment or publication occurred. The broader improvement goal remains active.
