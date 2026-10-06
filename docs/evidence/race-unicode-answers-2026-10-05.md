# Unicode race answers — 5 October 2026

Current and preloaded evaluation answers, and recorded-race guess requests, now enforce the game's seven-grapheme limit rather than seven UTF-16 string units. All three retain a 128-unit string bound, matching the existing live transport. Input trimming, NFC-based scoring, and original stored/evaluation answer bytes are retained. No UI copy or locale keys change.

The runtime reproduction used French “élément” in decomposed Unicode: nine string units, seven graphemes. The competitive catalog accepted it and the authoritative engine scored it correctly, but complete-evaluation responses and recorded guess requests rejected it. Matching baseline runs failed five core cases and eight real SDK cases. The fix passed thirteen new core cases and ten new SDK cases.

French and Russian decomposed accents, Japanese dakuten, and Hindi conjuncts are exercised. Real SDK cases create complete immutable decks, deliver evaluation or answer-free views, request hints, score validated guesses, and replay the same command without double advancement. Original private answers and canonical balances remain unchanged. Eight-slot input, invalid values, oversized raw strings, and trim semantics remain covered. The existing response-acceptance SDK suite adds thirteen controls for rejected presentation, repair, privacy, atomic publication, and settlement.

Validation of the frozen source:

- 338 shared-core tests across 36 suites.
- 1,657 backend unit tests across 134 suites.
- 367 emulator tests across 25 suites, plus the ten new SDK cases repeated on the pinned Firebase Functions Node 22 runtime.
- 59 focused client tests across six suites for native input, grapheme history, local feedback, revealed letters and advancement.
- Eight browser tests across three suites against owned Jest and Reddit builds. The existing buffered-transition assertion remains below 100 ms.
- Core, backend and client TypeScript, targeted lint, and TSDoc passed.
- All six isolated target builds and artifact audits passed. YouTube is an incomplete-content fixture build, not release certification.

The shared core was compiled and synchronized to the deployed package and installed backend copy before source freeze. Those copies were hash-checked. All 2,361 selected source inputs stayed unchanged through verification. All 1,300 built files and six target inventories were preserved with SHA-256 hashes before deleting only the owned temporary build root and matching metadata. Owned emulator ports closed after normal shutdown.

Two preliminary documentation audits reported missing comments in the new SDK fixture, including an inline object annotation. The fixture now uses the existing canonical run type and declaration comments; both subsequent documentation audits passed. These resolved preflights are recorded separately from intentional red regressions and final gates.

Evidence: [validated summary](../../artifacts/race-unicode-answers-2026-10-05/verification-summary.json), [runtime reproduction](../../artifacts/race-unicode-answers-2026-10-05/runtime-probe.log), [red core tests](../../artifacts/race-unicode-answers-2026-10-05/red-core.log), [red SDK tests](../../artifacts/race-unicode-answers-2026-10-05/red-emulator.log), [green SDK tests](../../artifacts/race-unicode-answers-2026-10-05/green-emulator.log), [Node 22 SDK verification](../../artifacts/race-unicode-answers-2026-10-05/node22-emulator.log), [synchronized core copies](../../artifacts/race-unicode-answers-2026-10-05/core-copies.json), [owned changes](../../artifacts/race-unicode-answers-2026-10-05/owned.diff), and [terminal jobs](../../artifacts/race-unicode-answers-2026-10-05/owned-jobs.json).

This improves localized race reliability and playability; no production latency improvement is claimed. The broader game improvement goal remains active. Further candidates need their own runtime reproduction before implementation.
