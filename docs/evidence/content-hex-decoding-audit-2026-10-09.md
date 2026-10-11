# Protected content decoding performance assessment — 2026-10-09

Byte-wise hexadecimal conversion is a justified optimization candidate. The shipped decoder materializes an array of two-character strings and parses every pair; the candidate retains the exact validation guard and protocol, but writes directly into one byte array. No production code has changed yet.

Actual generated English and Hindi locale packs were used with identical ciphertext per comparison. Each side ran nine alternating batches after warmup; first-use measurements additionally used nine fresh browser pages per side/locale. Decryption and domain-validation outputs were checked against the exact source pack. All reported runs completed with zero failures. CPU profiling ran separately from reported measurements and identifies `unhex`, its pair-parsing callback and regular-expression matching as substantial baseline CPU work.

Fresh-page decryption, UTF-8/JSON decoding and actual `parseYouTubeContentDocument` validation:

| Engine / locale | Baseline median (range), ms | Candidate median (range), ms |
| --- | --- | --- |
| Chromium / English | 9.2 (9.1–9.7) | 6.6 (6.5–6.9) |
| Chromium / Hindi | 12.4 (12.1–12.7) | 7.1 (7.0–7.4) |
| Firefox / English | 5 (4–6) | 3 (3–6) |
| Firefox / Hindi | 6 (5–7) | 4 (3–4) |

Firefox's coarse timer and English ranges overlap; an exploratory exact two-sided permutation rank check across nine samples per side gives p=0.0045 for that comparison. The other comparisons give p≈0.000041. This supports the direction on this machine, not a universal player latency guarantee. In Chromium, the first-use content stage saves approximately 2.6 ms for English and 5.3 ms for Hindi; other decoding, validation and cold-runtime costs remain, so an 80% helper improvement does not imply an 80% startup improvement.

Repeated whole-stage medians also improve: Chromium English 3.475→1.260 ms and Hindi 5.145→1.885 ms; Firefox English 2.05→0.95 ms and Hindi 2.85→1.30 ms. The local Node protected-pack-only experiment gives 2.970→0.592 ms and 4.493→0.887 ms respectively. All raw ranges/samples remain in the artifact; these measurements exclude module download, provider SDK startup, paint and network latency. They establish less CPU work in a critical startup content stage, not overall time to first playable question.

The machine has eight logical CPUs. Initial load averages were 0.14/0.49/0.89 and final 0.74/0.88/0.92. Node, Chromium and Firefox measurement jobs ran sequentially, while A/B order alternated inside each run. The browser benchmark is a production Vite bundle with real content/domain validation; browser and server/scratch cleanup completed successfully. Cached Firefox 153 and Chromium 153 were used.

Evidence is in `artifacts/content-hex-decoding-audit-2026-10-09`: plan, executable Node/browser benchmarks, baseline/candidate code, raw profile and summary, warm and cold samples, exact rank-check program/results, logs and unchanged-source proof. All 2,546 selected source inputs still match the preceding six-target build/test cohort.

Next action: adopt the measured loop, retain malformed-envelope and authenticated-decryption behavior, add larger multilingual round-trip coverage, prepare and verify shared-core copies, and rerun appropriate tests and all six isolated builds. No deployment or production performance improvement is claimed yet; the broader goal remains active.
