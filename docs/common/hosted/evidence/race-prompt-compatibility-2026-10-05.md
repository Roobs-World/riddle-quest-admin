# Race clue compatibility — 5 October 2026

Race category readiness now validates each clue against the shared published prompt schema. Oversized clues are rejected before a category is offered, a competitive deck is selected, or public/private live seats are committed. The existing `missing_metadata` issue code is reused. No UI copy or locale keys change.

A minimal runtime probe reproduced the defect: a 2,001-character clue passed pool validation and entered the deterministic deck, then failed the actual live view and complete-evaluation response schemas. Matching regression runs failed two unit cases and four actual Firestore SDK cases before the fix. After the fix, all ten new SDK cases and 51 focused race cases passed.

The shared schema trims before applying its 2,000-character bound. Tests retain that behavior: 2,000-character clues and padded stored clues of 2,002 characters remain legal. Real matchmaking crosses the countdown boundary successfully; both private 15-question decks retain the original authored bytes. Every deck position also validates through the complete-evaluation projection. Invalid text controls, the unaffected category, and canonical account balances are retained.

Validation of the frozen source:

- 1,657 backend unit tests across 134 suites.
- 344 emulator tests across 23 suites, including ten new clue compatibility cases.
- Eight browser tests across three suites against the owned Jest and Reddit builds. The existing buffered-transition assertion remains below 100 ms.
- Backend TypeScript, targeted lint, and the TSDoc audit passed.
- All six isolated target artifacts and their audits passed. YouTube is an incomplete-content fixture build, not release certification.
- 2,359 source inputs were unchanged across verification. All 1,300 built files and six target dependency inventories were preserved with SHA-256 hashes before removing the owned temporary build root and matching metadata. Owned emulator ports closed after normal shutdown.

The initial throwaway probe setup used the wrong relative creation directory and was corrected before reproduction. A preliminary documentation audit found three missing comments in the new test fixture; those were added and both subsequent documentation audits passed. Neither event is counted as a red regression or a final gate failure.

Evidence: [validated summary](../../../../artifacts/race-prompt-compatibility-2026-10-05/verification-summary.json), [runtime reproduction](../../../../artifacts/race-prompt-compatibility-2026-10-05/runtime-probe.log), [red units](../../../../artifacts/race-prompt-compatibility-2026-10-05/red-unit.log), [red SDK tests](../../../../artifacts/race-prompt-compatibility-2026-10-05/red-emulator.log), [green SDK tests](../../../../artifacts/race-prompt-compatibility-2026-10-05/green-emulator.log), [owned changes](../../../../artifacts/race-prompt-compatibility-2026-10-05/owned.diff), and [terminal jobs](../../../../artifacts/race-prompt-compatibility-2026-10-05/owned-jobs.json).

This is a reliability improvement at the catalog-to-response boundary; no production latency or bandwidth improvement is claimed. The broader game improvement goal remains active. A separate, unverified candidate concerns the difference between grapheme-based answer limits and UTF-16 limits in evaluation schemas; it needs a runtime reproduction before any policy change.
