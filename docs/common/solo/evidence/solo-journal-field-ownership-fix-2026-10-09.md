# Pending board field ownership and attempt-slot recovery — 2026-10-09

The prior saved-board fix validated row data but still spread the entire saved base into the current session. A follow-up audit found five concrete failures: extra serialized riddle, user and pause fields replaced current ownership; a null extra hint-lock list crashed draft restoration; and null saved keyboard feedback crashed confirmed hint reconciliation. One nominal control passed. Original durable request payloads survived the reader in every diagnostic case.

The reducer now projects only the explicit pending-presentation fields onto the current session. Current question, player, profile, lifecycle and purchased hint locks remain owned by the loaded session. Keyboard feedback is recomputed from already validated scored rows, then existing confirmed hint reconciliation restores purchased knowledge. Both pending restoration and rejection rollback use this projection. The existing locked-cursor test now supplies a real host-confirmed hint instead of relying on an extra base field outside PendingGuessState.

Injected browser verification found another issue before the final freeze: a usable saved checkpoint could already contain the queued attempt slot, and restoration previewed it again. The final reducer checks each original queued slot against the restored board's attempt count. Already represented slots are skipped in the presentation projection; later slots are previewed once. The delivery queue, exact request IDs, payloads, order and normal retry mechanism are unchanged.

## Evidence

- Original ownership diagnostic: five failures and one passing control, retained under `artifacts/solo-journal-field-ownership-audit-2026-10-09/`. The identical diagnostic passes all six cases on final source (`diagnostic-fixed.log` and JSON).
- Permanent regressions cover the five boundaries and a usable checkpoint already containing its pending slot. Full final client suite: 3,148 passing tests across 308 suites; 96 gated tests and 16 suites skipped.
- Real injected React router, recovery hook, reducer, storage, board and keyboard: 128 journeys, 1,488 passing assertions. Chromium 153 and Firefox 153, development and production React, widths 390 and 1280. Checks cover malformed rows/cells/snapshot/locks/keyboard map, serialized owner extras, draft and cursor retention, confirmed hint knowledge, exact delivery/journal/retry messages and no browser errors. Normal cases run with and without a confirmed attempt; keyboard-only cases intentionally use a fresh host-confirmed hint and no delivery queue.
- Initial Chromium development run had twelve failed duplicate-attempt assertions across four journeys. Its logs, screenshots, source manifest, full tests and initial builds are archived under `initial/`; final runs are separate.
- Final type check, TSDoc and source-size audit passed.
- All six isolated clients (Jest, Facebook, Reddit, YouTube fixture, Netflix candidate, Yahoo candidate) and Devvit server built on final source. Archived 1,299 output files and six dependency inventories, then removed only the owned temporary build root. Initial cohort outputs are also separately archived.
- Final cohort's 2,547 selected source/configuration inputs match before testing, after all processes terminated and after archival. Delta from the previous verified cohort: reducer and two regression files. No core/backend changes.

Final evidence is in `artifacts/solo-journal-field-ownership-fix-2026-10-09/`. This verifies client behavior with an injected host and controlled retry clock, not a live backend acknowledgement or physical-device latency. No deployment or publication occurred. The broader game improvement goal remains active.
