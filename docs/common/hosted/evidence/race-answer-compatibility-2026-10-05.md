# Race catalog answer compatibility — 5 October 2026

Competitive catalog readiness now rejects leading/trailing answer whitespace and checks original immutable answer text against the published evaluation schema. Locale-aware seven-slot validation remains in place. Existing `missing_metadata` and `answer_too_long` issue codes are reused; no UI copy or locale keys change. Private content is rejected rather than silently rewritten.

Two actual runtime probes reproduced the gap. A stored `" cat "` answer passed pool validation and yielded five slots, but the authoritative engine rejected both `"cat"` and `" cat "` because guessing trims before counting. A 129-unit answer consisting of one grapheme also passed pool validation but failed the public evaluation response. Matching regression runs failed six unit cases and ten real SDK cases before the fix.

After the fix, fourteen new real SDK cases and 59 focused race cases pass. Cases cover spaces, tabs/newlines, non-breaking spaces, oversized Unicode encoding, existing too-many-slot/type controls, both public and private joins, an unaffected category, and legal decomposed/uppercase answers. Invalid joins leave no seats, queues, pointers, signals or matches. Legal private decks retain their original answers; public projections remain valid at every position. Real correct-guess replay advances once and balances remain unchanged.

The single-player input audit found that ASCII-only guesses match its explicit authored transliteration and playable-answer policy. That policy was retained.

Validation of the frozen source:

- 1,665 backend unit tests across 134 suites.
- 381 emulator tests across 26 suites, including the new compatibility cases and existing Unicode/response-acceptance controls.
- Eight browser tests across three suites against owned Jest and Reddit builds. The buffered-transition assertion remains below 100 ms.
- Backend TypeScript, targeted lint and TSDoc passed.
- All six isolated target artifacts and audits passed. YouTube remains an incomplete-content fixture build, not release certification.
- All 2,362 selected source inputs remained unchanged. All 1,300 built files and six target inventories were preserved with SHA-256 hashes before removing only the owned temporary build root and matching metadata. Owned emulator ports closed after normal shutdown.

Evidence: [validated summary](../../../../artifacts/race-answer-compatibility-2026-10-05/verification-summary.json), [runtime reproduction](../../../../artifacts/race-answer-compatibility-2026-10-05/runtime-probe.log), [red units](../../../../artifacts/race-answer-compatibility-2026-10-05/red-unit.log), [red SDK tests](../../../../artifacts/race-answer-compatibility-2026-10-05/red-emulator.log), [green SDK tests](../../../../artifacts/race-answer-compatibility-2026-10-05/green-emulator.log), [single-player policy audit](../../../../artifacts/race-answer-compatibility-2026-10-05/single-player-policy-audit.json), [owned changes](../../../../artifacts/race-answer-compatibility-2026-10-05/owned.diff), and [terminal jobs](../../../../artifacts/race-answer-compatibility-2026-10-05/owned-jobs.json).

This change protects new catalog-based categories, decks and seats. Existing immutable challenge recordings and retained tickets need a separate compatibility audit; they are not rewritten by this pass. No production latency improvement is claimed. The broader improvement goal remains active.
