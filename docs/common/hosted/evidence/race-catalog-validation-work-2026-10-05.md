# Bounded catalog validation work — 2026-10-05

Status: complete and verified for this pass. The improvement goal remains active.

Fresh race catalog validation normalized oversized original answers for duplicate detection and clue-leak checks before rejecting the 128-unit authored-answer limit. A single invalid 200,000-unit answer went through two NFKC operations. Listing categories, starting a recording, and public/private live admission repeated this work through their actual game paths.

The fix gates only answer-dependent Unicode duplicate/leak work on the existing raw-answer budget. The primary `answer_too_long` rejection remains. Difficulty counts, clue and canonical duplicate checks, metadata validation, translation checks and all bounded answer diagnostics remain active. Bounded eight-slot answers still receive duplicate/leak diagnostics alongside their slot-limit error. Original answer bytes are never trimmed into acceptance, replaced or rewritten.

Oversized raw answers no longer receive Unicode duplicate-answer or literal-leak diagnostics; those unusable values receive their size error plus all independent diagnostics. This is the deliberate reporting change that bounds work and avoids retaining enormous normalized duplicate keys.

## Reproduction and controls

The final pure baseline was four failures and thirteen passing controls. Prototype observers executed the real ICU normalization and cached segmentation implementations. They showed two oversized NFKC calls from pool duplicate detection and the shared clue-leak helper; segmentation remained bounded. Only dimensions and owned call sites were retained in traces.

The four cases cover 129 ASCII units, 200,000 fullwidth units, 200,000 decomposed combining units, and 110,000 joined-emoji units. Storage-sized UTF-8 answers span 250–600 KB. The seventeen unit controls also cover English, French NFD, Hindi, punctuation, digits, emoji, zero-width text, a valid 128-unit grapheme, bounded compatibility/case duplicates, leaks and independent whole-pool diagnostics.

Four real SDK cases exercise category listing, creator recording and both public/private live entry. The retained original implementation failed all four work-count assertions despite correctly rejecting admission. Across the four paths, each case performed eight oversized normalization calls; the fixed implementation performs zero. Both versions retain exact profile data/version, original source bytes, the unaffected valid category, and no accepted runs, decks, receipts, attempts, match profiles, live pointers, queues, seats or signals.

The owned original source was temporarily restored for the red SDK run, then the fixed source was restored after actual emulator shutdown and before source freeze. No deployment or production account was involved.

## Paired performance evidence

Both TypeScript production implementations were compiled before timing with the same unchanged real dependencies and installed core library. The pinned Functions runtime was Node v22.23.1. Six fixtures used a baseline/fixed/fixed/baseline order: 480 measured validations plus 120 excluded warmups, forty samples per implementation/fixture. Every measured fixture has an identical validation result and unchanged source bytes.

| Fixture | Baseline median | Fixed median |
| --- | --- | --- |
| minimum | 0.214 ms | 0.202 ms |
| fullwidth | 2.525 ms | 0.264 ms |
| combining | 3.648 ms | 0.259 ms |
| joined-emoji | 2.324 ms | 0.335 ms |
| healthy | 0.169 ms | 0.169 ms |
| valid-128-units | 0.194 ms | 0.168 ms |

The three storage-sized invalid cases fall from 2.32–3.65 ms to 0.26–0.34 ms in this paired run. Healthy validation remains approximately 0.17 ms. These are synchronous 30-record validation timings, without spies; they exclude Firestore/network, client rendering/input and production concurrency. No universal timing threshold or network-latency improvement is claimed. Earlier Node 24 diagnostic timings and the smallest-case noise are retained separately.

## Verification

- Backend: 1,722 unit tests / 137 suites and 641 real emulator cases / 34 suites passed.
- Pinned Node 22: all 21 focused cases across the new unit and SDK suites passed.
- Backend typecheck, full lint, and TSDoc passed: 26,368 declarations across 1,179 files.
- All six fresh isolated builds and artifact audits passed: Jest, Facebook, Reddit, YouTube fixture, Netflix and Yahoo. YouTube remains an incomplete-content fixture, not release certification.
- Unchanged core/client evidence remains applicable: 374 core tests, 127 focused client tests, both typechecks and eight built-browser tests from the previous verified pass. Source/dependency hashes are unchanged; all 832 fresh Jest/Reddit files exactly match the bytes covered by those browser tests. Those tests were not rerun for this backend-only change.
- The verifier passed against 2,386 stable source inputs, 24 compiled/installed core hashes, the reversible three-file owned diff, diagnostic traces and every recorded terminal job.

All 1,300 fresh built files and six dependency inventories were preserved and hash-verified before deleting only the owned temporary root and matching inventories. The five owned emulator ports were closed. All nineteen recorded parent jobs reached actual terminal states; red reproductions and diagnostic failures are retained honestly.

## Diagnostic corrections

The first TSDoc probe required comments on four observation fields; corrected before freeze. A whole-build byte-equality preflight was too broad: YouTube/Netflix/Yahoo protected packs use fresh random IVs/ciphertext. It was replaced with exact equality of the Jest/Reddit outputs actually covered by the browser tests, plus the other targets' fresh audits. A generic string-similarity inspection of large random ciphertext was stopped only after verifying its owned PID/parent command; a linear inspection identified the IV/ciphertext differences. No source or built bytes were changed by that inspection. An output-root substitution was also corrected before any build started.

Evidence and the verifier are in [`artifacts/race-catalog-validation-work-2026-10-05`](../../../../artifacts/race-catalog-validation-work-2026-10-05/). No commit, push, deployment or production data mutation was performed; other shared checkout changes were preserved.

The goal is not exhausted. Creator recovery and cancellation controls for malformed retained invitation recordings remain a candidate for an evidence-led audit.
